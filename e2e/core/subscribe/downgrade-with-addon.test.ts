import { and, eq } from "drizzle-orm";
import { default as Stripe } from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { product, subscription } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  expectSingleActivePlanInGroup,
  expectSingleScheduledPlanInGroup,
  harness,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";
import { env } from "../../test-utils/env";

/**
 * Regression target: scheduleSubscriptionChange used to replace the schedule's
 * next phase with a single new item, silently dropping any other items (like
 * an add-on) that were on the subscription. This asserts the add-on survives
 * into the scheduled phase alongside the downgraded base plan.
 */
describe.skipIf(harness.id !== "stripe")(
  "downgrade-with-addon: scheduled downgrade keeps the add-on on both phases",
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
          id: "test_downgrade_addon",
          email: "downgrade-addon@test.com",
          name: "Downgrade With Addon Test",
        },
      });
      customerId = customer.customerId;

      await subscribeCustomer({
        t,
        customerId,
        planId: "ultra",
        addOnPlanIds: ["extra_messages"],
      });
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("downgrading ultra to pro schedules the change and keeps extra_messages on the subscription", async () => {
      try {
        await subscribeCustomer({ t, customerId, planId: "pro" });

        await expectProduct({
          database: t.database,
          customerId,
          planId: "ultra",
          expected: { status: "active", canceled: true },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "ultra",
        });
        await expectSingleScheduledPlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "pro",
        });

        // The add-on is untouched by the downgrade.
        await expectProduct({
          database: t.database,
          customerId,
          planId: "extra_messages",
          expected: { status: "active" },
        });

        const subRows = await t.database
          .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
          .from(subscription)
          .innerJoin(product, eq(product.internalId, subscription.productInternalId))
          .where(and(eq(subscription.customerId, customerId), eq(product.id, "extra_messages")))
          .limit(1);
        const stripeSubscriptionId = subRows[0]?.stripeSubscriptionId;
        if (!stripeSubscriptionId) {
          throw new Error("Expected extra_messages row to carry a stripeSubscriptionId");
        }

        const proProduct = await t.database.query.product.findFirst({
          where: eq(product.id, "pro"),
        });
        const addonProduct = await t.database.query.product.findFirst({
          where: eq(product.id, "extra_messages"),
        });
        if (!proProduct?.stripePriceId || !addonProduct?.stripePriceId) {
          throw new Error("Expected pro and extra_messages to be synced with Stripe prices");
        }

        const stripeSub = await stripeClient.subscriptions.retrieve(stripeSubscriptionId, {
          expand: ["schedule"],
        });
        const scheduleId =
          typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id;
        if (!scheduleId) {
          throw new Error("Expected a subscription schedule to exist after a scheduled downgrade");
        }
        const schedule = await stripeClient.subscriptionSchedules.retrieve(scheduleId);
        const nextPhase = schedule.phases[1];
        if (!nextPhase) {
          throw new Error("Expected a second schedule phase for the downgrade");
        }
        const nextPhasePriceIds = nextPhase.items.map((item) =>
          typeof item.price === "string" ? item.price : item.price.id,
        );

        expect(nextPhasePriceIds).toContain(proProduct.stripePriceId);
        expect(nextPhasePriceIds).toContain(addonProduct.stripePriceId);
      } catch (error) {
        await dumpStateOnFailure(t.database, t.dbPath);
        throw error;
      }
    });
  },
);
