import { and, eq, isNull, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { subscription } from "../../../packages/paykit/src/database/schema";
import {
  advanceTestClock,
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  subscribeCustomer,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";

/**
 * This is the exact corruption scenario a combined multi-item Stripe subscription
 * risks if the webhook path only ever resolves one PayKit row per Stripe
 * subscription: the second (and any further) renewal-driven webhook would only
 * update one of the two local rows, leaving the other frozen forever.
 */
describe("renewal-after-combined-checkout: both items roll forward together", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_renewal_combined",
        email: "renewal-combined@test.com",
        name: "Renewal Combined Test",
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

  it("advancing the clock past renewal keeps both plan and add-on active with fresh periods", async () => {
    try {
      const rowsBefore = await t.database
        .select({
          planInternalId: subscription.productInternalId,
          currentPeriodEndAt: subscription.currentPeriodEndAt,
        })
        .from(subscription)
        .where(and(eq(subscription.customerId, customerId), ne(subscription.status, "ended")));
      expect(rowsBefore.length).toBeGreaterThanOrEqual(2);

      const periodEnd = new Date(rowsBefore[0]!.currentPeriodEndAt as unknown as string);
      const advanceTo = new Date(periodEnd.getTime() + 86_400_000);
      const beforeAdvance = new Date();

      await advanceTestClock({ t, customerId, frozenTime: advanceTo });
      await waitForWebhook({
        after: beforeAdvance,
        database: t.database,
        eventType: "subscription.updated",
        timeout: 30_000,
      });

      // Poll until BOTH rows have rolled their period forward — not just one.
      let rowsAfter: Array<{ currentPeriodEndAt: unknown; status: string }> = [];
      for (let i = 0; i < 60; i++) {
        rowsAfter = await t.database
          .select({
            currentPeriodEndAt: subscription.currentPeriodEndAt,
            status: subscription.status,
          })
          .from(subscription)
          .where(and(eq(subscription.customerId, customerId), eq(subscription.status, "active")));

        const bothRolledForward =
          rowsAfter.length >= 2 &&
          rowsAfter.every((row) => {
            if (!row.currentPeriodEndAt) return false;
            return (
              new Date(row.currentPeriodEndAt as unknown as string).getTime() > periodEnd.getTime()
            );
          });
        if (bothRolledForward) break;

        if (i === 59) {
          throw new Error(
            `Not every subscription row rolled forward after renewal: ${JSON.stringify(rowsAfter)}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      expect(rowsAfter.length).toBeGreaterThanOrEqual(2);
      for (const row of rowsAfter) {
        expect(row.status).toBe("active");
      }

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

      // Entitlements still pool correctly after renewal — neither row went stale.
      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 700,
        remaining: 700,
      });

      const noEndedRows = await t.database
        .select({ id: subscription.id })
        .from(subscription)
        .where(and(eq(subscription.customerId, customerId), isNull(subscription.endedAt)));
      expect(noEndedRows.length).toBeGreaterThanOrEqual(2);
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
