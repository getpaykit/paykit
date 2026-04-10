import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getStripeAccountInfo } from "../../packages/paykit/src/cli/utils/format";
import { getPayKitConfig } from "../../packages/paykit/src/cli/utils/get-config";
import { createContext } from "../../packages/paykit/src/core/context";
import {
  getPendingMigrationCount,
  migrateDatabase,
  resolvePool,
} from "../../packages/paykit/src/database/index";
import {
  dryRunSyncProducts,
  syncProducts,
} from "../../packages/paykit/src/product/product-sync.service";
import { createCliFixture, type CliTestFixture } from "./setup";

const resolveDatabase = resolvePool;

describe("paykitjs check", () => {
  let fixture: CliTestFixture;

  beforeAll(async () => {
    fixture = await createCliFixture("__paykit_cli_check");
  });

  afterAll(async () => {
    const stored = (globalThis as Record<string, unknown>).__paykit_cli_check;
    if (stored && typeof stored === "object" && "end" in stored) {
      try {
        await (stored as { end: () => Promise<void> }).end();
      } catch {}
    }
    Reflect.deleteProperty(globalThis, "__paykit_cli_check");

    await fixture?.cleanup();
  });

  it("should detect config and report plan count", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const planCount = config.options.plans ? Object.values(config.options.plans).length : 0;
      expect(planCount).toBe(2);
      expect(config.options.provider).toBeTruthy();
    } finally {
      await database.end();
    }
  });

  it("should report pending migrations on fresh database", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const pending = await getPendingMigrationCount(database);
      expect(pending).toBeGreaterThan(0);
    } finally {
      await database.end();
    }
  });

  it("should connect to Stripe and retrieve account info", async () => {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const info = await getStripeAccountInfo(secretKey);

    expect(info.displayName).toBeTruthy();
    expect(info.mode).toBe("test mode");
  });

  it("should report schema up to date after migration", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      await migrateDatabase(database);

      const pending = await getPendingMigrationCount(database);
      expect(pending).toBe(0);
    } finally {
      await database.end();
    }
  });

  it("should report products not synced before push", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const ctx = await createContext({ ...config.options, database });
      const diffs = await dryRunSyncProducts(ctx);

      const hasChanges = diffs.some((d) => d.action !== "unchanged");
      expect(hasChanges).toBe(true);
      expect(diffs.length).toBe(2);
    } finally {
      await database.end();
    }
  });

  it("should report all synced after push", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const ctx = await createContext({ ...config.options, database });
      await syncProducts(ctx);

      const diffs = await dryRunSyncProducts(ctx);
      const allSynced = diffs.every((d) => d.action === "unchanged");
      expect(allSynced).toBe(true);
    } finally {
      await database.end();
    }
  });

  it("should verify database connectivity", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const ctx = await createContext({ ...config.options, database });
      const result = await ctx.database.execute(sql`SELECT 1 AS ok`);
      const row = result.rows[0] as { ok: number } | undefined;
      expect(row?.ok).toBe(1);
    } finally {
      await database.end();
    }
  });
});
