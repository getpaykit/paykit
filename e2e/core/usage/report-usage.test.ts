import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";

describe("report-usage: reporting usage against a combined licensed + metered subscription", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_report_usage",
        email: "report-usage@test.com",
        name: "Report Usage Test",
      },
    });
    customerId = customer.customerId;

    // A licensed base plan combined with a metered-usage plan in one checkout.
    await subscribeCustomer({
      t,
      customerId,
      planId: "pro",
      addOnPlanIds: ["metered_usage"],
    });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("reports usage events against the metered plan", async () => {
    try {
      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active" },
      });
      await expectProduct({
        database: t.database,
        customerId,
        planId: "metered_usage",
        expected: { status: "active" },
      });

      const first = await t.paykit.reportUsage({
        customerId,
        eventId: `test_report_usage_1_${String(Date.now())}`,
        featureId: "api_calls",
        quantity: 100,
      });
      expect(first.success).toBe(true);
      expect(first.providerEventId).toBeTruthy();

      const second = await t.paykit.reportUsage({
        customerId,
        eventId: `test_report_usage_2_${String(Date.now())}`,
        featureId: "api_calls",
        quantity: 50,
      });
      expect(second.success).toBe(true);
      expect(second.providerEventId).not.toBe(first.providerEventId);
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
