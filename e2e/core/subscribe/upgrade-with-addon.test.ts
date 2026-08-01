import { and, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { product, subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  expectSingleActivePlanInGroup,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";

describe("upgrade-with-addon: upgrading the base plan leaves the add-on's item untouched", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_upgrade_addon",
        email: "upgrade-addon@test.com",
        name: "Upgrade With Addon Test",
      },
    });
    customerId = customer.customerId;

    await subscribeCustomer({
      t,
      customerId,
      planId: "pro",
      addOnPlanIds: ["extra_messages"],
    });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("upgrading pro to ultra activates ultra and leaves extra_messages on its own item", async () => {
    try {
      const addonRowBefore = await t.database
        .select({ stripeSubscriptionItemId: subscription.stripeSubscriptionItemId })
        .from(subscription)
        .innerJoin(product, eq(product.internalId, subscription.productInternalId))
        .where(and(eq(subscription.customerId, customerId), eq(product.id, "extra_messages")))
        .limit(1);
      const addonItemIdBefore = addonRowBefore[0]?.stripeSubscriptionItemId;
      if (!addonItemIdBefore) {
        throw new Error(
          "Expected extra_messages to have a stripeSubscriptionItemId before upgrade",
        );
      }

      await subscribeCustomer({ t, customerId, planId: "ultra" });

      await expectProduct({
        database: t.database,
        customerId,
        planId: "ultra",
        expected: { status: "active", hasPeriodEnd: true },
      });
      await expectSingleActivePlanInGroup({
        database: t.database,
        customerId,
        group: "base",
        planId: "ultra",
      });
      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "ended" },
      });

      // The add-on is still active on the same Stripe subscription item.
      await expectProduct({
        database: t.database,
        customerId,
        planId: "extra_messages",
        expected: { status: "active" },
      });
      const addonRowAfter = await t.database
        .select({
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          stripeSubscriptionItemId: subscription.stripeSubscriptionItemId,
        })
        .from(subscription)
        .innerJoin(product, eq(product.internalId, subscription.productInternalId))
        .where(
          and(
            eq(subscription.customerId, customerId),
            eq(product.id, "extra_messages"),
            ne(subscription.status, "ended"),
          ),
        )
        .limit(1);
      expect(addonRowAfter[0]?.stripeSubscriptionItemId).toBe(addonItemIdBefore);

      // Ultra (10,000) + extra_messages (200) pool together.
      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 10_200,
        remaining: 10_200,
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
