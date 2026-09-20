import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(repositoryRoot, ".env"), quiet: true });

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
