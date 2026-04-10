import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import { createContext } from "../../core/context";
import { getPendingMigrationCount, migrateDatabase, resolvePool } from "../../database/index";
import { dryRunSyncProducts, syncProducts } from "../../product/product-sync.service";
import {
  formatPlanLine,
  formatPrice,
  getConnectionString,
  getStripeAccountInfo,
} from "../utils/format";
import { getPayKitConfig } from "../utils/get-config";
import { capture } from "../utils/telemetry";

async function pushAction(options: { config?: string; cwd: string; yes?: boolean }): Promise<void> {
  const cwd = path.resolve(options.cwd);

  p.intro("paykit push");

  const config = await getPayKitConfig({ configPath: options.config, cwd });
  const database = resolvePool(config.options.database);

  try {
    const connStr = getConnectionString(database as never);
    const stripeAccount = await getStripeAccountInfo(config.options.provider.secretKey);

    p.log.info(
      `Connected\n` +
        `  Database ${picocolors.dim("·")} ${connStr}\n` +
        `  Stripe   ${picocolors.dim("·")} ${stripeAccount.displayName} (${stripeAccount.mode})`,
    );

    // 1. Apply pending migrations first — schema must exist before querying products
    const pendingMigrations = await getPendingMigrationCount(database);

    if (pendingMigrations > 0) {
      await migrateDatabase(database);
      p.log.success(`Schema ${picocolors.dim("·")} migrated`);
    } else {
      p.log.step(`Schema ${picocolors.dim("·")} up to date`);
    }

    // 2. Dry-run product sync (safe — schema is guaranteed to exist now)
    const ctx = await createContext(config.options);
    const planDiffs = await dryRunSyncProducts(ctx);

    const hasPlanChanges = planDiffs.some((d) => d.action !== "unchanged");

    // Plan changes section
    if (planDiffs.length > 0) {
      const planLines = planDiffs.map((diff) => {
        const plan = ctx.plans.plans.find((pl) => pl.id === diff.id);
        const price = plan ? formatPrice(plan.priceAmount ?? 0, plan.priceInterval) : "$0";
        return formatPlanLine(diff.action, diff.id, price);
      });
      p.log.step(`Plan changes\n${planLines.join("\n")}`);
    }

    if (!hasPlanChanges && pendingMigrations === 0) {
      p.outro("Nothing to do");
      return;
    }

    // Confirmation prompt (for plan sync — migrations already applied)
    if (hasPlanChanges && !options.yes) {
      const shouldContinue = await p.confirm({ message: "Sync plans?" });
      if (p.isCancel(shouldContinue) || !shouldContinue) {
        p.cancel("Aborted");
        process.exit(0);
      }
    }

    // Execute plan sync
    const results = await syncProducts(ctx);
    const syncedCount = results.filter((r) => r.action !== "unchanged").length;
    if (syncedCount > 0) {
      p.log.success("Plans synced");
    }

    capture("cli_command", {
      command: "push",
      migrated: pendingMigrations > 0,
      planCount: results.length,
      plansSynced: syncedCount,
    });

    p.outro(
      `Done ${picocolors.dim("·")} ${String(results.length)} plan${results.length === 1 ? "" : "s"} synced`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(message);
    p.cancel("Push failed");
    process.exit(1);
  } finally {
    await database.end();
  }
}

export const pushCommand = new Command("push")
  .description("Apply migrations and sync plans to database and payment provider")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .option("-y, --yes", "skip confirmation prompt")
  .action(pushAction);
