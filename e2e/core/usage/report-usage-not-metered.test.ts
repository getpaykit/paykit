import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";

describe("report-usage-not-metered: reporting usage without an active metered subscription", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_report_usage_not_metered",
        email: "report-usage-not-metered@test.com",
        name: "Report Usage Not Metered Test",
      },
    });
    customerId = customer.customerId;

    await subscribeCustomer({ t, customerId, planId: "pro" });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("throws USAGE_NOT_METERED_FOR_CUSTOMER when there is no active metered plan", async () => {
    try {
      await expect(
        t.paykit.reportUsage({ customerId, featureId: "api_calls", quantity: 1 }),
      ).rejects.toMatchObject({
        code: "USAGE_NOT_METERED_FOR_CUSTOMER",
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
