import path from "node:path";

import { Command } from "commander";

import { createContext } from "../../core/context";
import { syncProducts } from "../../services/product-sync-service";
import { getPayKitConfig } from "../utils/get-config";
import { runPayKitMigrations } from "../utils/run-migrations";

export async function syncProductsAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const config = await getPayKitConfig({
    configPath: options.config,
    cwd,
  });

  try {
    await runPayKitMigrations(config);

    const ctx = await createContext(config.options);

    const results = await syncProducts(ctx);

    for (const result of results) {
      const versionLabel = `v${String(result.version)}`;
      if (result.action === "created") {
        console.info(`  + ${result.id} (${versionLabel}) created`);
      } else if (result.action === "updated") {
        console.info(`  ~ ${result.id} (${versionLabel}) updated`);
      } else {
        console.info(`  = ${result.id} (${versionLabel}) unchanged`);
      }
    }

    console.info(`\nSynced ${String(results.length)} product(s).`);
  } finally {
    await config.options.database.end();
  }
}

export const syncProductsCommand = new Command("sync-products")
  .description("Sync product definitions to database and payment provider")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .action(syncProductsAction);
