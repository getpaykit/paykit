import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";
import StripeSdk from "stripe";

import { createContext } from "../../core/context";
import { getPendingMigrationCount, resolvePool } from "../../database/index";
import { dryRunSyncProducts } from "../../product/product-sync.service";
import {
  formatPlanLine,
  formatPrice,
  getConnectionString,
  getStripeAccountInfo,
} from "../utils/format";
import { getPayKitConfig } from "../utils/get-config";
import { capture } from "../utils/telemetry";

async function checkAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);

  p.intro("paykit check");

  let config;
  try {
    config = await getPayKitConfig({ configPath: options.config, cwd });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Config\n  ${picocolors.red("✖")} ${message}`);
    p.outro("Fix config issues before continuing");
    process.exit(1);
  }

  const planCount = config.options.plans ? Object.values(config.options.plans).length : 0;
  const hasProvider = Boolean(config.options.provider);

  p.log.info(
    `Config\n` +
      `  ${picocolors.green("✔")} ${picocolors.dim(config.path)}\n` +
      `  ${picocolors.green("✔")} ${String(planCount)} product${planCount === 1 ? "" : "s"} defined\n` +
      `  ${hasProvider ? picocolors.green("✔") : picocolors.red("✖")} ${hasProvider ? "Stripe provider configured" : "No provider configured"}`,
  );

  if (!hasProvider) {
    p.outro("Fix config issues before continuing");
    process.exit(1);
  }

  const database = resolvePool(config.options.database);
  const connStr = getConnectionString(database as never);
  let pendingMigrations = 0;

  try {
    await database.query("SELECT 1");
    pendingMigrations = await getPendingMigrationCount(database);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Database\n  ${picocolors.red("✖")} ${connStr}\n  ${message}`);
    p.outro("Fix database issues before continuing");
    await database.end();
    process.exit(1);
  }

  const migrationStatus =
    pendingMigrations > 0
      ? `${picocolors.red("✖")} Schema needs migration`
      : `${picocolors.green("✔")} Schema up to date`;

  p.log.info(`Database\n  ${picocolors.green("✔")} ${connStr}\n  ${migrationStatus}`);

  const stripeAccount = await getStripeAccountInfo(config.options.provider.secretKey);

  let webhookStatus: string;
  try {
    const client = new StripeSdk(config.options.provider.secretKey);
    const endpoints = await client.webhookEndpoints.list({ limit: 100 });
    const activeEndpoints = endpoints.data.filter((ep) => ep.status === "enabled");
    if (activeEndpoints.length > 0) {
      const lines = activeEndpoints.map((ep) =>
        picocolors.dim(`- Webhook endpoint registered (${ep.url})`),
      );
      webhookStatus = lines.join("\n  ");
    } else {
      webhookStatus = picocolors.dim("- No webhook endpoint (use Stripe CLI for local testing)");
    }
  } catch {
    webhookStatus = `${picocolors.dim("?")} Could not check webhook status`;
  }

  p.log.info(
    `Stripe\n` +
      `  ${picocolors.green("✔")} ${stripeAccount.displayName} (${stripeAccount.mode})\n` +
      `  ${webhookStatus}`,
  );

  let hasIssues = pendingMigrations > 0;

  if (pendingMigrations > 0) {
    p.log.info(
      `Products\n  ${picocolors.dim("?")} Cannot check sync status until migrations are applied`,
    );
  } else {
    const ctx = await createContext(config.options);
    const diffs = await dryRunSyncProducts(ctx);

    if (diffs.length === 0) {
      p.log.info(`Products\n  ${picocolors.dim("No products defined")}`);
    } else {
      const allSynced = diffs.every((d) => d.action === "unchanged");
      if (!allSynced) {
        hasIssues = true;
      }
      const header = allSynced
        ? `${picocolors.green("✔")} All synced`
        : `${picocolors.red("✖")} Not synced (run ${picocolors.bold("paykitjs push")})`;

      const planLines = diffs.map((diff) => {
        const plan = ctx.plans.plans.find((pl) => pl.id === diff.id);
        const price = plan ? formatPrice(plan.priceAmount ?? 0, plan.priceInterval) : "$0";
        return formatPlanLine(diff.action, diff.id, price);
      });

      p.log.info(`Products\n  ${header}\n${planLines.join("\n")}`);
    }
  }

  capture("cli_command", {
    command: "check",
    needsMigration: pendingMigrations > 0,
  });

  await database.end();

  if (hasIssues) {
    p.outro(`Run ${picocolors.bold("paykitjs push")} to apply migrations and sync plans`);
    process.exit(1);
  }

  p.outro("Everything looks good");
}

export const checkCommand = new Command("check")
  .description("Check PayKit configuration and sync status")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .action(checkAction);
