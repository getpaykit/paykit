#!/usr/bin/env node

import { Command } from "commander";

import { initCommand } from "./commands/init";
import { pushCommand } from "./commands/push";
import { statusCommand } from "./commands/status";

const program = new Command()
  .name("paykitjs")
  .description("CLI for PayKit")
  .addCommand(initCommand)
  .addCommand(pushCommand)
  .addCommand(statusCommand);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n  error: ${message}\n`);
  process.exit(1);
}
