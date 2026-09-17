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

let cleanupPromise;
let receivedSignal;
let tunnelProcess;
let testProcess;

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onError = (error) => {
      cleanup();
      resolve({ code: null, error, signal: null });
    };
    const onExit = (code, signal) => {
      cleanup();
      resolve({ code, error: null, signal });
    };

    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  let graceTimer;
  await Promise.race([
    waitForExit(child),
    new Promise((resolve) => {
      graceTimer = setTimeout(resolve, 5_000);
    }),
  ]).finally(() => clearTimeout(graceTimer));

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

function stopChildren() {
  cleanupPromise ??= (async () => {
    await terminate(testProcess);
    await terminate(tunnelProcess);
  })();
  return cleanupPromise;
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
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(hubPort, "127.0.0.1", resolve);
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new Error(
        `Hub port ${String(hubPort)} already in use. Kill any stale webhook server before running tests.`,
        { cause: error },
      );
    }
    throw error;
  }
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
    const failure = (message) =>
      new Error(`${message}\n\ncloudflared output:\n${output.trim() || "(no output)"}`);
    const timeout = setTimeout(() => {
      cleanup();
      reject(failure("Timed out waiting for cloudflared readiness"));
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
        failure(
          `cloudflared exited before tests started (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    };
    const onError = (error) => {
      cleanup();
      reject(failure(`cloudflared failed to start: ${error.message}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off("error", onError);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", onError);
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
  if (receivedSignal) return;
  await validateHubPort();
  if (receivedSignal) return;

  tunnelProcess = startTunnel();
  await waitForTunnel(tunnelProcess);
  console.log(`Cloudflare Tunnel ready. Logs: ${cloudflaredLogPath}`);

  testProcess = startTests();
  const outcome = await Promise.race([
    waitForExit(testProcess).then((result) => ({ source: "tests", ...result })),
    waitForExit(tunnelProcess).then((result) => ({ source: "tunnel", ...result })),
  ]);
  if (receivedSignal) return;

  if (outcome.source === "tunnel") {
    const failure = outcome.error
      ? `cloudflared failed: ${outcome.error.message}`
      : `cloudflared exited during tests (code=${String(outcome.code)}, signal=${String(outcome.signal)})`;
    throw new Error(failure);
  }
  if (outcome.error) {
    throw new Error(`Failed to start Stripe E2E tests: ${outcome.error.message}`, {
      cause: outcome.error,
    });
  }
  if (outcome.code !== 0) {
    process.exitCode = outcome.code ?? 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    receivedSignal = signal;
    const signalExitCode = signal === "SIGINT" ? 130 : 143;
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exitCode = signalExitCode;
    }
    void stopChildren().finally(() => process.exit(process.exitCode ?? signalExitCode));
  });
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (!receivedSignal) {
    process.exitCode = 1;
  }
} finally {
  await stopChildren();
}
