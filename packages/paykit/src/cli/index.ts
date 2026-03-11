#!/usr/bin/env node

import { Command } from "commander";

import { migrateCommand } from "./commands/migrate";

const program = new Command()
  .name("paykitjs")
  .description("CLI for PayKit")
  .addCommand(migrateCommand);

await program.parseAsync(process.argv);
