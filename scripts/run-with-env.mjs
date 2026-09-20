import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(repositoryRoot, ".env"), quiet: true });

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");

const child = spawn(command, args, {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

function terminateChild(signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32" && child.pid !== undefined) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  child.kill(signal);
}

const signalHandlers = new Map();
for (const signal of ["SIGINT", "SIGTERM"]) {
  const handler = () => terminateChild(signal);
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  for (const [forwardedSignal, handler] of signalHandlers) {
    process.off(forwardedSignal, handler);
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
