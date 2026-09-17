import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import net from "node:net";
import { devNull } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import "../../scripts/load-root-env.js";

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(e2eRoot, "..");
const cloudflaredLogPath = path.join(repoRoot, "cloudflared.log");
const hubPort = 4567;
const watch = process.argv.includes("--watch");
const forwardedArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--watch" && argument !== "--");
const requiredEnvironment = [
  "CF_TUNNEL_TOKEN",
  "E2E_STRIPE_SK",
  "E2E_STRIPE_WHSEC",
  "TEST_DATABASE_URL",
];

let stopping = false;
let tunnelProcess;
let testProcess;

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  await Promise.race([waitForExit(child), new Promise((resolve) => setTimeout(resolve, 5_000))]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

async function stopChildren() {
  if (stopping) return;
  stopping = true;
  await terminate(testProcess);
  await terminate(tunnelProcess);
}

function validateEnvironment() {
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required E2E configuration: ${missing.join(", ")}`);
  }
}

function validateCloudflared() {
  const result = spawnSync("cloudflared", ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error("cloudflared is required to run Stripe E2E tests");
  }
}

async function validateDatabase() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query("SELECT 1");
  } finally {
    await pool.end();
  }
}

async function validateHubPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(hubPort, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function startTunnel() {
  const log = createWriteStream(cloudflaredLogPath, { flags: "w" });
  const child = spawn(
    "cloudflared",
    ["tunnel", "--config", devNull, "--url", `http://127.0.0.1:${String(hubPort)}`, "run"],
    {
      env: { ...process.env, TUNNEL_TOKEN: process.env.CF_TUNNEL_TOKEN },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.once("close", () => log.end());
  return child;
}

async function waitForTunnel(child) {
  const readyPattern =
    /Registered tunnel|Connection [A-Za-z0-9]+ registered|Registered tunnel connection/;

  await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for cloudflared readiness"));
    }, 30_000);

    const onData = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-8_192);
      if (readyPattern.test(output)) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(
        new Error(
          `cloudflared exited before tests started (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", onExit);
  });
}

function startTests() {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const vitestArguments = [
    "exec",
    "vitest",
    ...(watch ? [] : ["run"]),
    "--project=core",
    ...forwardedArguments,
  ];
  return spawn(pnpm, vitestArguments, {
    cwd: e2eRoot,
    env: { ...process.env, PROVIDER: "stripe" },
    stdio: "inherit",
  });
}

async function run() {
  validateEnvironment();
  validateCloudflared();
  await validateDatabase();
  await validateHubPort();

  tunnelProcess = startTunnel();
  await waitForTunnel(tunnelProcess);
  console.log(`Cloudflare Tunnel ready. Logs: ${cloudflaredLogPath}`);

  testProcess = startTests();
  const outcome = await Promise.race([
    waitForExit(testProcess).then((result) => ({ source: "tests", ...result })),
    waitForExit(tunnelProcess).then((result) => ({ source: "tunnel", ...result })),
  ]);

  if (outcome.source === "tunnel") {
    throw new Error(
      `cloudflared exited during tests (code=${String(outcome.code)}, signal=${String(outcome.signal)})`,
    );
  }
  if (outcome.code !== 0) {
    process.exitCode = outcome.code ?? 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void stopChildren().then(() => {
      process.exitCode = signal === "SIGINT" ? 130 : 143;
    });
  });
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stopChildren();
}
