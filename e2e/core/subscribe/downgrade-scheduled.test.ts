import { afterAll, beforeAll, describe, it } from "vitest";

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

describe.skipIf(!harness.capabilities.repeatedHostedCheckout)(
  "downgrade-scheduled: ultra → pro",
  () => {
    let t: TestPayKit;
    let customerId: string;

    beforeAll(async () => {
      t = await createTestPayKit();
      const customer = await createTestCustomerWithPM({
        t,
        customer: {
          id: "test_downgrade",
          email: "downgrade@test.com",
          name: "Downgrade Test",
        },
      });
      customerId = customer.customerId;

      // Setup: subscribe to Pro then upgrade to Ultra
      await subscribeCustomer({ t, customerId, planId: "pro" });

      await subscribeCustomer({ t, customerId, planId: "ultra" });
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("downgrading to a lower tier schedules the change at period end", async () => {
      try {
        await subscribeCustomer({ t, customerId, planId: "pro" });

        // Ultra is still active but marked as canceled
        await expectProduct({
          database: t.database,
          customerId,
          planId: "ultra",
          expected: {
            status: "active",
            canceled: true,
          },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "ultra",
        });

        // Pro is scheduled for activation at period end
        await expectSingleScheduledPlanInGroup({
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
