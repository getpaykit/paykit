import { default as Stripe } from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { syncProducts } from "../../../packages/paykit/src/product/product-sync.service";
import { createTestPayKit, dumpStateOnFailure, harness, type TestPayKit } from "../../test-utils";
import { env } from "../../test-utils/env";

describe.skipIf(harness.id !== "stripe")(
  "metered-plan-sync: a metered plan syncs to a Stripe Meter + metered Price",
  () => {
    let t: TestPayKit;
    let stripeClient: Stripe;

    beforeAll(async () => {
      stripeClient = new Stripe(env.E2E_STRIPE_SK!, { maxNetworkRetries: 3 });
      t = await createTestPayKit();
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("creates a Stripe Billing Meter + metered Price, and re-syncing is idempotent", async () => {
      try {
        const productRow = await t.database.query.product.findFirst({
          where: (p, { eq }) => eq(p.id, "metered_usage"),
        });
        if (!productRow?.stripePriceId) {
          throw new Error("Expected metered_usage to be synced with a Stripe price");
        }
        expect(productRow.priceUsageType).toBe("metered");
        expect(productRow.meteredFeatureId).toBe("api_calls");

        const price = await stripeClient.prices.retrieve(productRow.stripePriceId);
        expect(price.recurring?.usage_type).toBe("metered");
        expect(price.recurring?.meter).toBeTruthy();

        const meterId = price.recurring!.meter!;
        const meter = await stripeClient.billing.meters.retrieve(meterId);
        expect(meter.event_name).toBe("api_calls");

        // Re-syncing must not create a duplicate meter or price.
        await syncProducts(t.ctx);

        const productRowAfter = await t.database.query.product.findFirst({
          where: (p, { eq }) => eq(p.id, "metered_usage"),
        });
        expect(productRowAfter?.stripePriceId).toBe(productRow.stripePriceId);

        const meters = await stripeClient.billing.meters.list({ status: "active" });
        const matchingMeters = meters.data.filter((m) => m.event_name === "api_calls");
        expect(matchingMeters.length).toBe(1);
      } catch (error) {
        await dumpStateOnFailure(t.database, t.dbPath);
        throw error;
      }
    });
  },
);
