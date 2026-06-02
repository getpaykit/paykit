import { desc, eq } from "drizzle-orm";
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
  "subscription-deleted: Stripe cancels subscription directly",
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
          id: "test_sub_deleted",
          email: "sub-deleted@test.com",
          name: "Subscription Deleted Test",
        },
      });
      customerId = customer.customerId;

      // Setup: subscribe to Pro
      await subscribeCustomer({ t, customerId, planId: "pro" });

      // Get Stripe subscription ID from the stored subscription row.
      const subRows = await t.database
        .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
        .from(subscription)
        .where(eq(subscription.customerId, customerId))
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

    it("when Stripe cancels a subscription directly, PayKit ends the product and activates free", async () => {
      try {
        const beforeCancel = new Date();

        // Cancel directly via Stripe API (simulates Stripe dashboard cancellation)
        await stripeClient.subscriptions.cancel(providerSubscriptionId);
        await waitForWebhook({
          after: beforeCancel,
          database: t.database,
          eventType: "subscription.deleted",
          timeout: 30_000,
        });

        // Pro should be canceled/ended
        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { canceled: true, status: "canceled" },
        });

        // Free should be active (default plan activated)
        await expectProduct({
          database: t.database,
          customerId,
          planId: "free",
          expected: {
            status: "active",
            hasPeriodEnd: false,
          },
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
