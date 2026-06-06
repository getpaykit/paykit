import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { subscription, webhookEvent } from "../../../packages/paykit/src/database/schema";
import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectNoScheduledPlanInGroup,
  expectProduct,
  expectSingleActivePlanInGroup,
  replayWebhookRequest,
  subscribeCustomer,
  type TestPayKit,
  waitForForwardedWebhookRequest,
  waitForWebhook,
} from "../../test-utils";

describe("duplicate-webhook: same event delivered twice", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_dup_webhook",
        email: "dup-webhook@test.com",
        name: "Duplicate Webhook Test",
      },
    });
    customerId = customer.customerId;
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("processing the same webhook event twice is idempotent", async () => {
    try {
      const beforeSubscribe = new Date();

      await subscribeCustomer({ t, customerId, planId: "pro" });

      const subscriptionWebhook = await waitForWebhook({
        after: beforeSubscribe,
        database: t.database,
        eventType: "subscription.updated",
      });
      const providerEventId = String(subscriptionWebhook.stripeEventId);
      const forwardedRequest = await waitForForwardedWebhookRequest({
        after: beforeSubscribe,
        providerEventId,
        requests: t.webhookRequests,
      });

      await waitForWebhook({
        after: beforeSubscribe,
        database: t.database,
        eventType: "invoice.updated",
      });

      const webhookCountBeforeRows = await t.database
        .select({ count: count() })
        .from(webhookEvent)
        .where(eq(webhookEvent.stripeEventId, providerEventId));
      const webhookCountBefore = webhookCountBeforeRows[0]?.count ?? 0;

      const subscriptionCountBeforeRows = await t.database
        .select({ count: count() })
        .from(subscription)
        .where(eq(subscription.customerId, customerId));
      const subscriptionCountBefore = subscriptionCountBeforeRows[0]?.count ?? 0;

      await replayWebhookRequest({ request: forwardedRequest });
      await new Promise((resolve) => setTimeout(resolve, 1_500));

      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active" },
      });
      await expectSingleActivePlanInGroup({
        database: t.database,
        customerId,
        group: "base",
        planId: "pro",
      });
      await expectNoScheduledPlanInGroup({
        database: t.database,
        customerId,
        group: "base",
      });
      await expectExactMeteredBalance({
        customerId,
        featureId: "messages",
        limit: 500,
        paykit: t.paykit,
        remaining: 500,
      });

      const webhookCountAfterRows = await t.database
        .select({ count: count() })
        .from(webhookEvent)
        .where(eq(webhookEvent.stripeEventId, providerEventId));
      const webhookCountAfter = webhookCountAfterRows[0]?.count ?? 0;

      const subscriptionCountAfterRows = await t.database
        .select({ count: count() })
        .from(subscription)
        .where(eq(subscription.customerId, customerId));
      const subscriptionCountAfter = subscriptionCountAfterRows[0]?.count ?? 0;

      expect(webhookCountBefore).toBe(1);
      expect(webhookCountAfter).toBe(1);
      expect(subscriptionCountAfter).toBe(subscriptionCountBefore);
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
