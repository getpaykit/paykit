import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestCustomerWithPM,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  subscribeCustomer,
  type TestPayKit,
} from "../../test-utils";

describe("remove-last-item-rejected: can't remove a subscription's only item", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    const customer = await createTestCustomerWithPM({
      t,
      customer: {
        id: "test_remove_last_item",
        email: "remove-last-item@test.com",
        name: "Remove Last Item Test",
      },
    });
    customerId = customer.customerId;

    await subscribeCustomer({ t, customerId, planId: "pro" });
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("removing the only item on the subscription throws a clear error", async () => {
    try {
      await expect(t.paykit.removeAddOn({ customerId, planId: "pro" })).rejects.toMatchObject({
        code: "PROVIDER_SUBSCRIPTION_ITEM_REMOVAL_REJECTED",
      });

      // The plan is untouched by the rejected attempt.
      await expectProduct({
        database: t.database,
        customerId,
        planId: "pro",
        expected: { status: "active" },
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});
