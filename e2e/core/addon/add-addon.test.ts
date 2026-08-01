import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";

describe("add-addon: attaching an add-on to an already-active subscription", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_add_addon",
        email: "add-addon@test.com",
        name: "Add Addon Test",
      },
    });
    customerId = customer.customerId;

    await subscribeCustomer({ t, customerId, planId: "pro" });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("adding extra_messages attaches a second item to the same Stripe subscription", async () => {
    try {
      const result = await t.paykit.addAddOn({ customerId, planId: "extra_messages" });
      expect(result.paymentUrl).toBeNull();

      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active" },
      });
      await expectProduct({
        database: t.database,
        customerId,
        planId: "extra_messages",
        expected: { status: "active" },
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
