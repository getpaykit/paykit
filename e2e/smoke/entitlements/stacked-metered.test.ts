import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectExactMeteredBalance,
  type TestPayKit,
} from "../setup";

describe("stacked-metered: cross-group entitlement aggregation", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_stacked_metered",
        email: "stacked-metered@test.com",
        name: "Stacked Metered Test",
      },
    });
    customerId = customer.customerId;

    // Pro (base group): 500 messages/month
    await t.paykit.subscribe({
      customerId,
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    // Extra Messages (addons group): 200 messages/month
    await t.paykit.subscribe({
      customerId,
      planId: "extra_messages",
      successUrl: "https://example.com/success",
    });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("check returns aggregated balance across groups", async () => {
    try {
      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 700,
        remaining: 700,
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });

  it("report succeeds when amount exceeds any single row but fits the total", async () => {
    try {
      // 600 exceeds Pro's 500 and addon's 200 individually, but 700 total covers it
      const report = await t.paykit.report({ customerId, featureId: "messages", amount: 600 });
      expect(report.success).toBe(true);
      expect(report.balance!.remaining).toBe(100);

      await expectExactMeteredBalance({
        paykit: t.paykit,
        customerId,
        featureId: "messages",
        limit: 700,
        remaining: 100,
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });

  it("report fails when amount exceeds the combined balance", async () => {
    try {
      // Only 100 remaining after previous test
      const report = await t.paykit.report({ customerId, featureId: "messages", amount: 200 });
      expect(report.success).toBe(false);
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
