import { and, eq } from "drizzle-orm";
import { default as Stripe } from "stripe";
import { afterAll, beforeAll, describe, it } from "vitest";

import { product, subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  harness,
  subscribeCustomer,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";
import { env } from "../../test-utils/env";

/**
 * Removing a subscription item outside of `removeAddOn` (e.g. directly in the
 * Stripe Dashboard) must still be caught: reconcileRemovedSubscriptionItems is
 * the eventual-consistency backstop that ends the now-stale local row once the
 * resulting webhook arrives.
 */
describe.skipIf(harness.id !== "stripe")(
  "remove-addon-out-of-band: an item deleted directly in Stripe still gets reconciled",
  () => {
    let t: TestPayKit;
    let customerId: string;
    let stripeClient: Stripe;

    beforeAll(async () => {
      stripeClient = new Stripe(env.E2E_STRIPE_SK!, { maxNetworkRetries: 3 });
      t = await createTestPayKit();
      const customer = await createTestCustomerWithPM({
        t,
        customer: {
          id: "test_remove_addon_oob",
          email: "remove-addon-oob@test.com",
          name: "Remove Addon Out Of Band Test",
        },
      });
      customerId = customer.customerId;

      await subscribeCustomer({ t, customerId, planId: "pro" });
      await t.paykit.addAddOn({ customerId, planId: "extra_messages" });
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("deleting the add-on's Stripe item directly still ends the local row", async () => {
      try {
        const addonRow = await t.database
          .select({ stripeSubscriptionItemId: subscription.stripeSubscriptionItemId })
          .from(subscription)
          .innerJoin(product, eq(product.internalId, subscription.productInternalId))
          .where(
            and(
              eq(subscription.customerId, customerId),
              eq(product.id, "extra_messages"),
              eq(subscription.status, "active"),
            ),
          )
          .limit(1);
        const itemId = addonRow[0]?.stripeSubscriptionItemId;
        if (!itemId) {
          throw new Error("Expected extra_messages to have an active stripeSubscriptionItemId");
        }

        const beforeDelete = new Date();
        await stripeClient.subscriptionItems.del(itemId, { proration_behavior: "none" });

        await waitForWebhook({
          after: beforeDelete,
          database: t.database,
          eventType: "subscription.updated",
          timeout: 30_000,
        });

        // Poll until reconciliation ends the stale row.
        let ended = false;
        for (let i = 0; i < 30; i++) {
          const row = await t.database.query.subscription.findFirst({
            where: eq(subscription.stripeSubscriptionItemId, itemId),
          });
          if (row?.status === "ended") {
            ended = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!ended) {
          throw new Error(
            "extra_messages row was never reconciled to ended after out-of-band removal",
          );
        }

        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { status: "active" },
        });

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
  },
);
