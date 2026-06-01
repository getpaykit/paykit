import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, it } from "vitest";

import { paymentMethod, product, subscription } from "../../../packages/paykit/src/database/schema";
import {
  advanceTestClock,
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  expectSingleActivePlanInGroup,
  harness,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";

describe.skipIf(!harness.capabilities.testClocks)(
  "resubscribe-after-cancel: checkout after full cancellation",
  () => {
    let t: TestPayKit;
    let customerId: string;

    beforeAll(async () => {
      t = await createTestPayKit();
      const customer = await createTestCustomerWithPM({
        t,
        customer: {
          id: "test_resub",
          email: "resub@test.com",
          name: "Resubscribe Test",
        },
      });
      customerId = customer.customerId;

      // Setup: subscribe Pro → cancel to Free → advance clock (full cancellation)
      await t.paykit.subscribe({
        customerId,
        planId: "pro",
        successUrl: "https://example.com/success",
      });

      await t.paykit.subscribe({
        customerId,
        planId: "free",
        successUrl: "https://example.com/success",
      });

      // Advance past period end so subscription fully cancels
      const subRows = await t.database
        .select({ currentPeriodEndAt: subscription.currentPeriodEndAt })
        .from(subscription)
        .where(eq(subscription.customerId, customerId))
        .orderBy(desc(subscription.updatedAt))
        .limit(1);
      const periodEnd = new Date(subRows[0]!.currentPeriodEndAt as unknown as string);
      const advanceTo = new Date(periodEnd.getTime() + 86_400_000);
      await advanceTestClock({
        t,
        customerId,
        frozenTime: advanceTo,
      });

      // Wait for Free to activate
      for (let i = 0; i < 60; i++) {
        const rows = await t.database
          .select({ status: subscription.status })
          .from(subscription)
          .innerJoin(product, eq(product.internalId, subscription.productInternalId))
          .where(
            and(
              eq(subscription.customerId, customerId),
              eq(product.id, "free"),
              eq(subscription.status, "active"),
            ),
          );
        if (rows.length > 0) break;
        if (i === 59) throw new Error("Free never activated in setup");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Clear stale payment method (Stripe removes it on full cancellation)
      await t.database.delete(paymentMethod).where(eq(paymentMethod.customerId, customerId));
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("resubscribing after full cancellation requires checkout", async () => {
      try {
        const beforeCheckout = new Date();

        const result = await t.paykit.subscribe({
          customerId,
          planId: "pro",
          successUrl: "https://example.com/success",
        });

        // Should require checkout (payment method was cleared)
        if (!result.paymentUrl) {
          throw new Error("Expected checkout URL but got direct subscription");
        }

        await t.harness.completeCheckout(result.paymentUrl);

        await waitForWebhook({
          database: t.database,
          eventType: "checkout.completed",
          after: beforeCheckout,
          timeout: 120_000,
        });

        // Pro is active again
        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { status: "active", hasPeriodEnd: true },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "pro",
        });
      } catch (error) {
        await dumpStateOnFailure(t.database, t.dbPath);
        throw error;
      }
    });
  },
);
