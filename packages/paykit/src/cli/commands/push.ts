import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import { createContext } from "../../core/context";
import { getPendingMigrationCount, migrateDatabase } from "../../database/index";
import { dryRunSyncProducts, syncProducts } from "../../services/product-sync-service";
import {
  formatPlanLine,
  formatPrice,
  getConnectionString,
  getStripeAccountInfo,
} from "../utils/format";
import { getPayKitConfig } from "../utils/get-config";

async function pushAction(options: { config?: string; cwd: string; yes?: boolean }): Promise<void> {
  const cwd = path.resolve(options.cwd);

  p.intro("paykit push");

  const config = await getPayKitConfig({ configPath: options.config, cwd });

  try {
    const connStr = getConnectionString(config.options.database as never);
    const stripeAccount = await getStripeAccountInfo(config.options.provider.secretKey);

    p.log.info(
      `Connected\n` +
        `  Database ${picocolors.dim("·")} ${connStr}\n` +
        `  Stripe   ${picocolors.dim("·")} ${stripeAccount.displayName} (${stripeAccount.mode})`,
    );

    // Dry-run: check what needs to change
    const pendingMigrations = await getPendingMigrationCount(config.options.database);
    const ctx = await createContext(config.options);
    const planDiffs = await dryRunSyncProducts(ctx);

    const hasChanges = pendingMigrations > 0 || planDiffs.some((d) => d.action !== "unchanged");

    // Schema section
    if (pendingMigrations > 0) {
      p.log.step(
        `${String(pendingMigrations)} pending migration${pendingMigrations === 1 ? "" : "s"}`,
      );
    } else {
      p.log.step(`Schema ${picocolors.dim("·")} up to date`);
    }

    // Plan changes section
    if (planDiffs.length > 0) {
      const planLines = planDiffs.map((diff) => {
        const plan = ctx.plans.plans.find((pl) => pl.id === diff.id);
        const price = plan ? formatPrice(plan.priceAmount ?? 0, plan.priceInterval) : "$0";
        return formatPlanLine(diff.action, diff.id, price);
      });
      p.log.step(`Plan changes\n${planLines.join("\n")}`);
    }

    if (!hasChanges) {
      p.outro("Nothing to do");
      return;
    }

    // Confirmation prompt
    if (!options.yes) {
      const shouldContinue = await p.confirm({ message: "Apply changes?" });
      if (p.isCancel(shouldContinue) || !shouldContinue) {
        p.cancel("Aborted");
        process.exit(0);
      }
    }

    // Execute
    if (pendingMigrations > 0) {
      await migrateDatabase(config.options.database);
      p.log.success("Schema migrated");
    }

    const results = await syncProducts(ctx);
    const syncedCount = results.filter((r) => r.action !== "unchanged").length;
    if (syncedCount > 0) {
      p.log.success("Plans synced");
    }

    // Summary
    const parts: string[] = [];
    if (pendingMigrations > 0) {
      parts.push(`${String(pendingMigrations)} migration${pendingMigrations === 1 ? "" : "s"}`);
    }
    parts.push(`${String(results.length)} plan${results.length === 1 ? "" : "s"} synced`);

    p.outro(`Done ${picocolors.dim("·")} ${parts.join(", ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(message);
    p.cancel("Push failed");
    process.exit(1);
  } finally {
    await config.options.database.end();
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
