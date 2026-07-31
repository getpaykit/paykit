import { and, eq } from "drizzle-orm";
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

describe("remove-addon: detaching an active add-on", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_remove_addon",
        email: "remove-addon@test.com",
        name: "Remove Addon Test",
      },
    });
    customerId = customer.customerId;

    await subscribeCustomer({ t, customerId, planId: "pro" });
    await t.paykit.addAddOn({ customerId, planId: "extra_messages" });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("removing extra_messages ends it immediately and leaves pro untouched", async () => {
    try {
      await t.paykit.removeAddOn({ customerId, planId: "extra_messages" });

      // Ends synchronously, without waiting on a webhook.
      await expectProduct({
        database: t.database,
        customerId,
        planId: "extra_messages",
        expected: { status: "ended" },
      });
      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active" },
      });

      const activeRows = await t.database
        .select({ stripeSubscriptionItemId: subscription.stripeSubscriptionItemId })
        .from(subscription)
        .where(and(eq(subscription.customerId, customerId), eq(subscription.status, "active")));
      expect(activeRows.length).toBe(1);

      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 500,
        remaining: 500,
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
