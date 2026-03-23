#!/usr/bin/env node

import { Command } from "commander";

import { migrateCommand } from "./commands/migrate";
import { syncProductsCommand } from "./commands/sync-products";

const program = new Command()
  .name("paykitjs")
  .description("CLI for PayKit")
  .addCommand(migrateCommand)
  .addCommand(syncProductsCommand);

await program.parseAsync(process.argv);
