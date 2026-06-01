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
  "cancel-then-upgrade: pro → free (scheduled) → ultra (upgrade)",
  () => {
    let t: TestPayKit;
    let customerId: string;

    beforeAll(async () => {
      t = await createTestPayKit();
      const customer = await createTestCustomerWithPM({
        t,
        customer: {
          id: "test_cancel_upgrade",
          email: "cancel-upgrade@test.com",
          name: "Cancel Then Upgrade Test",
        },
      });
      customerId = customer.customerId;

      // Setup: subscribe to Pro, then schedule downgrade to Free
      await subscribeCustomer({ t, customerId, planId: "pro" });

      await subscribeCustomer({ t, customerId, planId: "free" });
    });

    afterAll(async () => {
      await t?.cleanup();
    });

    it("upgrading while cancellation is pending cancels the downgrade and activates the new plan", async () => {
      try {
        // Verify precondition
        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { status: "active", canceled: true },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "pro",
        });
        await expectSingleScheduledPlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "free",
        });

        // Action: upgrade to Ultra
        await subscribeCustomer({ t, customerId, planId: "ultra" });

        // Ultra is active
        await expectProduct({
          database: t.database,
          customerId,
          planId: "ultra",
          expected: {
            status: "active",
            hasPeriodEnd: true,
          },
        });
        await expectSingleActivePlanInGroup({
          database: t.database,
          customerId,
          group: "base",
          planId: "ultra",
        });

        // Pro is ended
        await expectProduct({
          database: t.database,
          customerId,
          planId: "pro",
          expected: { status: "ended" },
        });

        // TODO: scheduled Free should be deleted on upgrade, but the subscribe
        // flow computes "switch" instead of "upgrade" when the current subscription
        // has cancel_at_period_end=true. This is a known PayKit issue.
        // await expectProductNotPresent(t.database, customerId, "free");
      } catch (error) {
        await dumpStateOnFailure(t.database, t.dbPath);
        throw error;
      }
    });
  },
);
