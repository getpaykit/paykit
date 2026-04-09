import { asc, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPayKitConfig } from "../../packages/paykit/src/cli/utils/get-config";
import { createContext } from "../../packages/paykit/src/core/context";
import {
  getPendingMigrationCount,
  migrateDatabase,
  resolvePool,
} from "../../packages/paykit/src/database/index";
import { product } from "../../packages/paykit/src/database/schema";
import {
  dryRunSyncProducts,
  syncProducts,
} from "../../packages/paykit/src/product/product-sync.service";
import { createCliFixture, type CliTestFixture } from "./setup";

const resolveDatabase = resolvePool;

describe("paykitjs push", () => {
  let fixture: CliTestFixture;

  beforeAll(async () => {
    fixture = await createCliFixture("__paykit_cli_push");
  });

  afterAll(async () => {
    // Close any pool stored on globalThis by jiti
    const stored = (globalThis as Record<string, unknown>).__paykit_cli_push;
    if (stored && typeof stored === "object" && "end" in stored) {
      try {
        await (stored as { end: () => Promise<void> }).end();
      } catch {}
    }
    Reflect.deleteProperty(globalThis, "__paykit_cli_push");

    await fixture?.cleanup();
  });

  it("should apply migrations on a fresh database", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const pending = await getPendingMigrationCount(database);
      expect(pending).toBeGreaterThan(0);

      await migrateDatabase(database);

      const pendingAfter = await getPendingMigrationCount(database);
      expect(pendingAfter).toBe(0);
    } finally {
      await database.end();
    }
  });

  it("should sync plans to the database and Stripe", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const ctx = await createContext({ ...config.options, database });
      const results = await syncProducts(ctx);

      // Should have synced 2 plans (free + pro)
      const synced = results.filter((r) => r.action !== "unchanged");
      expect(synced.length).toBe(2);

      // Verify plans exist in the database
      const dbRows = await ctx.database
        .select({
          id: product.id,
          name: product.name,
          group: product.group,
          is_default: product.isDefault,
        })
        .from(product)
        .orderBy(asc(product.id));
      expect(dbRows).toEqual([
        { id: "free", name: "Free", group: "base", is_default: true },
        { id: "pro", name: "Pro", group: "base", is_default: false },
      ]);

      // Verify paid plan (pro) was synced to Stripe via provider JSONB
      const providerRows = await ctx.database
        .select({ id: product.id, provider: product.provider })
        .from(product)
        .where(eq(product.id, "pro"))
        .orderBy(desc(product.version))
        .limit(1);
      const proProduct = providerRows[0] as
        | { id: string; provider: Record<string, { productId: string }> }
        | undefined;
      expect(proProduct).toBeTruthy();
      const stripeInfo = proProduct?.provider.stripe;
      expect(stripeInfo).toBeTruthy();
      if (!stripeInfo) {
        throw new Error("Missing Stripe product metadata for synced plan");
      }

      const stripeProduct = await fixture.stripeClient.products.retrieve(stripeInfo.productId);
      expect(stripeProduct.active).toBe(true);
    } finally {
      await database.end();
    }
  });

  it("should report nothing to do on second push", async () => {
    const config = await getPayKitConfig({ cwd: fixture.cwd });
    const database = resolveDatabase(config.options.database);
    try {
      const ctx = await createContext({ ...config.options, database });
      const diffs = await dryRunSyncProducts(ctx);

      const hasChanges = diffs.some((d) => d.action !== "unchanged");
      expect(hasChanges).toBe(false);
    } finally {
      await database.end();
    }
  });
});
