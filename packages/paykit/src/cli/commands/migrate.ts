import path from "node:path";

import { Command } from "commander";

import { getPayKitConfig } from "../utils/get-config";
import { runPayKitMigrations } from "../utils/run-migrations";

export async function migrateAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const config = await getPayKitConfig({
    configPath: options.config,
    cwd,
  });

  try {
    await runPayKitMigrations(config);
    console.info("PayKit migrations applied successfully.");
  } finally {
    await config.state.database.end();
  }
}

export const migrateCommand = new Command("migrate")
  .description("Apply PayKit database migrations")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .action(migrateAction);
