import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import {
  checkDatabase,
  checkProvider,
  checkProviderCustomers,
  createPool,
  formatProductDiffs,
  loadCliDeps,
  loadProductDiffs,
} from "../utils/shared";
import { printUpdateNotification, startUpdateCheck } from "../utils/update-check";

async function statusAction(options: {
  config?: string;
  cwd: string;
  throw?: boolean;
}): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const s = p.spinner();

  const updateCheck = startUpdateCheck();
  s.start("Checking");

  const deps = await loadCliDeps();

  deps.capture("cli_command", { command: "status" });

  const pm = deps.detectPackageManager(cwd);
  const pushCmd = deps.getRunCommand(pm, "paykitjs push");

  // Config
  let config;
  try {
    config = await deps.getPayKitConfig({ configPath: options.config, cwd });
  } catch (error) {
    s.stop("");
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Config\n  ${picocolors.red("✖")} ${message}`);
    process.exit(1);
  }

  const planCount = config.options.products ? Object.values(config.options.products).length : 0;
  const hasStripe = Boolean(config.options.stripe);

  if (!hasStripe) {
    s.stop("");
    p.log.error(
      `Config\n` +
        `  ${picocolors.green("✔")} ${picocolors.dim(config.path)}\n` +
        `  ${picocolors.green("✔")} ${String(planCount)} plan${planCount === 1 ? "" : "s"} defined\n` +
        `  ${picocolors.red("✖")} No Stripe config found`,
    );
    p.outro("Fix config issues before continuing");
    process.exit(1);
  }

  // Database + Provider in parallel
  const database = createPool(deps, config.options.database);
  const connStr = deps.getConnectionString(database as never);

  const [dbResult, providerResult] = await Promise.all([
    checkDatabase(database, deps),
    checkProvider(config.options.stripe),
  ]);

  if (!dbResult.ok) {
    s.stop("");
    p.log.error(`Database\n  ${picocolors.red("✖")} ${connStr}\n  ${dbResult.message}`);
    p.outro("Fix database issues before continuing");
    await database.end();
    process.exit(1);
  }

  if (!providerResult.account.ok) {
    s.stop("");
    p.log.error(`Stripe\n  ${picocolors.red("✖")} ${providerResult.account.message}`);
    p.outro("Fix Stripe issues before continuing");
    await database.end();
    process.exit(1);
  }

  const pendingMigrations = dbResult.pendingMigrations;

  let preflightErrors: string[] = [...providerResult.errors];

  let webhookStatus: string;
  if (providerResult.webhookEndpoints === null) {
    webhookStatus = `${picocolors.dim("?")} Could not check webhook status`;
  } else if (providerResult.webhookEndpoints.length > 0) {
    const lines = providerResult.webhookEndpoints.map((ep) => {
      const label = ep.status === "enabled" ? "registered" : `status: ${ep.status}`;
      return picocolors.dim(`· Webhook endpoint ${label} (${ep.url})`);
    });
    webhookStatus = lines.join("\n  ");
  } else {
    webhookStatus = picocolors.dim("· No webhook endpoint (use provider CLI for local testing)");
  }

  // Products
  let needsSync = false;
  let productsBlock: string;

  if (pendingMigrations > 0) {
    productsBlock = `Products\n  ${picocolors.dim("?")} Cannot check sync status until migrations are applied`;
  } else {
    const { ctx, diffs } = await loadProductDiffs(config, deps);

    const customerErrors = await checkProviderCustomers(ctx, providerResult.customerSample);
    preflightErrors = [...preflightErrors, ...customerErrors];

    if (diffs.length === 0) {
      productsBlock = `Products\n  ${picocolors.dim("No products defined")}`;
    } else {
      const allSynced = diffs.every((d) => d.action === "unchanged");
      if (!allSynced) needsSync = true;

      const header = allSynced
        ? `${picocolors.green("✔")} All synced`
        : `${picocolors.red("✖")} Not synced (run ${picocolors.bold(pushCmd)})`;

      const planLines = formatProductDiffs(diffs, ctx.products.plans, deps);
      productsBlock = `Products\n  ${header}\n${planLines.join("\n")}`;
    }
  }

  await database.end();

  // Render everything at once
  const migrationStatus =
    pendingMigrations > 0
      ? `${picocolors.red("✖")} Schema needs migration`
      : `${picocolors.green("✔")} Schema up to date`;

  s.stop("");

  p.log.info(
    `Config\n` +
      `  ${picocolors.green("✔")} ${picocolors.dim(config.path)}\n` +
      `  ${picocolors.green("✔")} ${String(planCount)} plan${planCount === 1 ? "" : "s"} defined\n` +
      `  ${picocolors.green("✔")} Stripe configured`,
  );

  p.log.info(`Database\n  ${picocolors.green("✔")} ${connStr}\n  ${migrationStatus}`);

  p.log.info(
    `Stripe\n` +
      `  ${picocolors.green("✔")} ${providerResult.account.displayName} (${providerResult.account.mode})\n` +
      `  ${webhookStatus}`,
  );

  p.log.info(productsBlock);

  if (preflightErrors.length > 0) {
    const errorLines = preflightErrors.map((err) => `  ${picocolors.red("✖")} ${err}`);
    p.log.error(`Preflight\n${errorLines.join("\n")}`);
  }

  const needsMigration = pendingMigrations > 0;
  const hasIssues = needsMigration || needsSync || preflightErrors.length > 0;

  if (hasIssues) {
    if (needsMigration || needsSync) {
      const action =
        needsMigration && needsSync
          ? "apply migrations and sync products"
          : needsMigration
            ? "apply migrations"
            : "sync products";
      p.outro(`Run ${picocolors.bold(pushCmd)} to ${action}`);
    } else {
      p.outro("Resolve the preflight errors above before continuing");
    }
    await printUpdateNotification(updateCheck, deps.getInstallCommand(pm, ["paykitjs@latest"]));
    if (options.throw) process.exit(1);
  } else {
    p.outro("Everything looks good");
    await printUpdateNotification(updateCheck, deps.getInstallCommand(pm, ["paykitjs@latest"]));
  }
}

export const statusCommand = new Command("status")
  .description("Check PayKit configuration and sync status")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("--config <config>", "the path to the PayKit configuration file to load.")
  .option("--throw", "exit with code 1 if there are issues")
  .action(statusAction);
