import { and, desc, eq, isNotNull } from "drizzle-orm";
import { default as Stripe } from "stripe";
import { afterAll, beforeAll, describe, it } from "vitest";

import { subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  expectSingleActivePlanInGroup,
  harness,
  subscribeCustomer,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";
import { env } from "../../test-utils/env";

describe.skipIf(harness.id !== "stripe")(
  "subscription-deleted-multi-item: deleting a combined subscription ends every item",
  () => {
    let t: TestPayKit;
    let customerId: string;
    let providerSubscriptionId: string;
    let stripeClient: Stripe;

    beforeAll(async () => {
      stripeClient = new Stripe(env.E2E_STRIPE_SK!, { maxNetworkRetries: 3 });
      t = await createTestPayKit();
      const customer = await createTestCustomerWithPM({
        t,
        customer: {
          id: "test_sub_deleted_multi",
          email: "sub-deleted-multi@test.com",
          name: "Subscription Deleted Multi Test",
        },
      });
      customerId = customer.customerId;

      await subscribeCustomer({
        t,
        customerId,
        planId: "pro",
        addOnPlanIds: ["extra_messages"],
      });

      const subRows = await t.database
        .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
        .from(subscription)
        .where(
          and(
            eq(subscription.customerId, customerId),
            isNotNull(subscription.stripeSubscriptionId),
          ),
        )
        .orderBy(desc(subscription.updatedAt))
        .limit(1);
      const stripeSubscriptionId = subRows[0]?.stripeSubscriptionId;
      if (!stripeSubscriptionId) {
        throw new Error("Expected stripeSubscriptionId on subscription row");
      }
      providerSubscriptionId = stripeSubscriptionId;
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("canceling the whole Stripe subscription ends both the plan and the add-on locally", async () => {
      try {
        const beforeCancel = new Date();

        await stripeClient.subscriptions.cancel(providerSubscriptionId);
        await waitForWebhook({
          after: beforeCancel,
          database: t.database,
          eventType: "subscription.deleted",
          timeout: 30_000,
        });

        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { canceled: true, status: "canceled" },
        });
        await expectProduct({
          database: t.database,
          customerId,
          planId: "extra_messages",
          expected: { canceled: true, status: "canceled" },
        });

        // The base group falls back to its default free plan.
        await expectProduct({
          database: t.database,
          customerId,
          planId: "free",
          expected: { status: "active", hasPeriodEnd: false },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "free",
        });
      } catch (error) {
        await dumpStateOnFailure(t.database, t.dbPath);
        throw error;
      }
    });
  },
);
