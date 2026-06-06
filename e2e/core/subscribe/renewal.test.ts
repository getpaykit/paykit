import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { subscription } from "../../../packages/paykit/src/database/schema";
import {
  advanceTestClock,
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  expectProduct,
  expectSingleActivePlanInGroup,
  subscribeCustomer,
  type TestPayKit,
  waitForWebhook,
} from "../../test-utils";

describe("renewal: pro subscription renews after 1 month", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_renewal",
        email: "renewal@test.com",
        name: "Renewal Test",
      },
    });
    customerId = customer.customerId;

    // Setup: subscribe to Pro
    await subscribeCustomer({ t, customerId, planId: "pro" });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("advancing clock 1 month rolls period dates forward and resets usage", async () => {
    try {
      const usage = await t.paykit.report({
        customerId,
        featureId: "messages",
        amount: 37,
      });
      expect(usage.success).toBe(true);
      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 500,
        remaining: 463,
      });

      // Record current period end
      const subRows = await t.database
        .select({ currentPeriodEndAt: subscription.currentPeriodEndAt })
        .from(subscription)
        .where(eq(subscription.customerId, customerId))
        .orderBy(desc(subscription.updatedAt))
        .limit(1);
      const periodEnd = new Date(subRows[0]!.currentPeriodEndAt as unknown as string);

      // Advance clock 1 day past period end
      const advanceTo = new Date(periodEnd.getTime() + 86_400_000);
      const beforeAdvance = new Date();
      await advanceTestClock({
        t,
        customerId,
        frozenTime: advanceTo,
      });
      await waitForWebhook({
        after: beforeAdvance,
        database: t.database,
        eventType: "subscription.updated",
        timeout: 30_000,
      });

      // Poll until period dates change after the forwarded renewal event is processed
      let newPeriodEnd = periodEnd;
      for (let i = 0; i < 60; i++) {
        const rows = await t.database
          .select({ currentPeriodEndAt: subscription.currentPeriodEndAt })
          .from(subscription)
          .where(and(eq(subscription.customerId, customerId), eq(subscription.status, "active")))
          .orderBy(desc(subscription.updatedAt))
          .limit(1);
        const row = rows[0];
        if (row?.currentPeriodEndAt) {
          const end = new Date(row.currentPeriodEndAt as unknown as string);
          if (end.getTime() > periodEnd.getTime()) {
            newPeriodEnd = end;
            break;
          }
        }
        if (i === 59) throw new Error("Period dates never rolled forward after clock advance");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Period end moved forward
      expect(newPeriodEnd.getTime()).toBeGreaterThan(periodEnd.getTime());

      // Pro is still active
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
