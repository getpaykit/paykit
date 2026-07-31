import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomer,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";

describe("combined-checkout: base plan + add-on in one checkout", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomer({
      t,
      customer: {
        id: "test_combined_checkout",
        email: "combined-checkout@test.com",
        name: "Combined Checkout Test",
      },
    });
    customerId = customer.customerId;
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("subscribing to a plan with an add-on returns one checkout URL for both", async () => {
    try {
      const beforeCheckout = new Date();

      const result = await t.paykit.subscribe({
        addOnPlanIds: ["extra_messages"],
        customerId,
        planId: "pro",
        successUrl: "https://example.com/success",
      });

      if (!result.paymentUrl) {
        throw new Error("Expected a combined checkout URL");
      }

      await t.harness.completeCheckout(result.paymentUrl);

      await waitForWebhook({
        database: t.database,
        eventType: "checkout.completed",
        after: beforeCheckout,
        timeout: 120_000,
      });

      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active", hasPeriodEnd: true },
      });
      await expectProduct({
        database: t.database,
        customerId,
        planId: "extra_messages",
        expected: { status: "active", hasPeriodEnd: true },
      });

      const rows = await t.database
        .select({
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          stripeSubscriptionItemId: subscription.stripeSubscriptionItemId,
        })
        .from(subscription)
        .where(eq(subscription.customerId, customerId));
      const activeRows = rows.filter((row) => row.stripeSubscriptionId != null);

      const distinctSubscriptionIds = new Set(activeRows.map((row) => row.stripeSubscriptionId));
      expect(distinctSubscriptionIds.size).toBe(1);

      const itemIds = activeRows
        .map((row) => row.stripeSubscriptionItemId)
        .filter((id): id is string => id != null);
      expect(new Set(itemIds).size).toBe(itemIds.length);
      expect(itemIds.length).toBeGreaterThanOrEqual(2);

      // Entitlements pool across both the base plan and the add-on.
      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 700,
        remaining: 700,
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
