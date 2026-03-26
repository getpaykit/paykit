import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";
import StripeSdk from "stripe";

import { createContext } from "../../core/context";
import { getPendingMigrationCount } from "../../database/index";
import { dryRunSyncProducts } from "../../services/product-sync-service";
import {
  formatPlanLine,
  formatPrice,
  getConnectionString,
  getStripeAccountInfo,
} from "../utils/format";
import { getPayKitConfig } from "../utils/get-config";

async function statusAction(options: { config?: string; cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);

  p.intro("paykit status");

  // Config section
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

  // Database section
  const connStr = getConnectionString(config.options.database as never);
  let pendingMigrations = 0;

  try {
    await config.options.database.query("SELECT 1");
    pendingMigrations = await getPendingMigrationCount(config.options.database);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Database\n  ${picocolors.red("✖")} ${connStr}\n  ${message}`);
    p.outro("Fix database issues before continuing");
    await config.options.database.end();
    process.exit(1);
  }

  const migrationStatus =
    pendingMigrations > 0
      ? `${picocolors.red("✖")} ${String(pendingMigrations)} pending migration${pendingMigrations === 1 ? "" : "s"}`
      : `${picocolors.green("✔")} Schema up to date`;

  p.log.info(`Database\n  ${picocolors.green("✔")} ${connStr}\n  ${migrationStatus}`);

  // Stripe section
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

  // Products section
  try {
    const ctx = await createContext(config.options);
    const diffs = await dryRunSyncProducts(ctx);

    if (diffs.length === 0) {
      p.log.info(`Products\n  ${picocolors.dim("No products defined")}`);
    } else {
      const allSynced = diffs.every((d) => d.action === "unchanged");
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
  } catch {
    p.log.error(
      `Products\n  ${picocolors.red("✖")} Could not check sync status (run migrations first)`,
    );
  }

  // Final
  const hasIssues = pendingMigrations > 0;
  if (hasIssues) {
    p.outro(`Run ${picocolors.bold("paykitjs push")} to get started`);
  } else {
    p.outro("Everything looks good");
  }

  await config.options.database.end();
}

export const statusCommand = new Command("status")
  .description("Check PayKit configuration and sync status")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .action(statusAction);
