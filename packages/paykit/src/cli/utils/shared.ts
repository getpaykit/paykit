import type { Pool } from "pg";

import type { createContext, PayKitContext } from "../../core/context";
import type { getPendingMigrationCount, migrateDatabase } from "../../database/index";
import type { dryRunSyncProducts, syncProducts } from "../../product/product-sync.service";
import type { PayKitProviderConfig } from "../../providers/provider";
import type { PayKitOptions } from "../../types/options";
import type { NormalizedPlan } from "../../types/schema";
import type { detectPackageManager, getInstallCommand, getRunCommand } from "./detect";
import type { formatPlanLine, formatPrice, getConnectionString } from "./format";
import type { getPayKitConfig } from "./get-config";
import type { capture } from "./telemetry";

export interface CliDeps {
  Pool: typeof Pool;
  createContext: typeof createContext;
  getPendingMigrationCount: typeof getPendingMigrationCount;
  migrateDatabase: typeof migrateDatabase;
  dryRunSyncProducts: typeof dryRunSyncProducts;
  syncProducts: typeof syncProducts;
  formatPlanLine: typeof formatPlanLine;
  formatPrice: typeof formatPrice;
  getConnectionString: typeof getConnectionString;
  getPayKitConfig: typeof getPayKitConfig;
  capture: typeof capture;
  detectPackageManager: typeof detectPackageManager;
  getInstallCommand: typeof getInstallCommand;
  getRunCommand: typeof getRunCommand;
}

export async function loadCliDeps(): Promise<CliDeps> {
  const [pg, context, database, productSync, format, getConfig, telemetry, detect] =
    await Promise.all([
      import("pg"),
      import("../../core/context"),
      import("../../database/index"),
      import("../../product/product-sync.service"),
      import("../utils/format"),
      import("../utils/get-config"),
      import("../utils/telemetry"),
      import("../utils/detect"),
    ]);

  return {
    Pool: pg.Pool,
    createContext: context.createContext,
    getPendingMigrationCount: database.getPendingMigrationCount,
    migrateDatabase: database.migrateDatabase,
    dryRunSyncProducts: productSync.dryRunSyncProducts,
    syncProducts: productSync.syncProducts,
    formatPlanLine: format.formatPlanLine,
    formatPrice: format.formatPrice,
    getConnectionString: format.getConnectionString,
    getPayKitConfig: getConfig.getPayKitConfig,
    capture: telemetry.capture,
    detectPackageManager: detect.detectPackageManager,
    getInstallCommand: detect.getInstallCommand,
    getRunCommand: detect.getRunCommand,
  };
}

export interface LoadedConfig {
  path: string;
  options: PayKitOptions;
}

export function createPool(deps: Pick<CliDeps, "Pool">, database: Pool | string): Pool {
  return typeof database === "string" ? new deps.Pool({ connectionString: database }) : database;
}

export interface ProductDiff {
  action: "archived" | "created" | "updated" | "unchanged";
  id: string;
  name: string;
  priceAmount: number | null;
  priceInterval: string | null;
}

export function formatProductDiffs(
  diffs: ProductDiff[],
  plans: readonly NormalizedPlan[],
  deps: Pick<CliDeps, "formatPlanLine" | "formatPrice">,
): string[] {
  const plansById = new Map(plans.map((pl) => [pl.id, pl]));
  return diffs.map((diff) => {
    const plan = plansById.get(diff.id);
    const amount = plan?.priceAmount ?? diff.priceAmount ?? 0;
    const interval = plan?.priceInterval ?? diff.priceInterval;
    const price = deps.formatPrice(amount, interval);
    return deps.formatPlanLine(diff.action, diff.id, price);
  });
}

export async function checkDatabase(
  database: Pool,
  deps: Pick<CliDeps, "getPendingMigrationCount">,
): Promise<{ ok: true; pendingMigrations: number } | { ok: false; message: string }> {
  try {
    await database.query("SELECT 1");
    const count = await deps.getPendingMigrationCount(database);
    return { ok: true, pendingMigrations: count };
  } catch (error) {
    const err = error as { message?: string; code?: string };
    const message = err.message || err.code || "Connection failed";
    return { ok: false, message };
  }
}

export interface ProviderCheckResult {
  account: { ok: true; displayName: string; mode: string } | { ok: false; message: string };
  webhookEndpoints: Array<{ url: string; status: string }> | null;
}

export async function checkProvider(
  providerConfig: PayKitProviderConfig,
): Promise<ProviderCheckResult> {
  try {
    const adapter = providerConfig.createAdapter();
    const result = await adapter.check?.();

    if (!result) {
      return {
        account: { ok: true, displayName: providerConfig.name, mode: "unknown" },
        webhookEndpoints: null,
      };
    }

    if (result.ok) {
      return {
        account: { ok: true, displayName: result.displayName, mode: result.mode },
        webhookEndpoints: result.webhookEndpoints ?? null,
      };
    }

    return {
      account: { ok: false, message: result.error ?? "Provider check failed" },
      webhookEndpoints: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider check failed";
    return {
      account: { ok: false, message },
      webhookEndpoints: null,
    };
  }
}

export async function loadProductDiffs(
  config: LoadedConfig,
  deps: Pick<CliDeps, "createContext" | "dryRunSyncProducts">,
): Promise<{ ctx: PayKitContext; diffs: ProductDiff[] }> {
  const ctx = await deps.createContext(config.options);
  const diffs = await deps.dryRunSyncProducts(ctx);
  return { ctx, diffs };
}
