import { eq } from "drizzle-orm";
import { product, subscription } from "paykitjs/database";
import { afterAll, beforeAll, describe, it } from "vitest";

import {
  createTestCustomer,
  createTestPayKit,
  dumpStateOnFailure,
  expectProduct,
  expectSingleActivePlanInGroup,
  expectSubscription,
  type TestPayKit,
} from "../../test-utils";

describe("subscribe-paid-checkout: free → pro via checkout", () => {
  let t: TestPayKit;
  let customerId: string;

  beforeAll(async () => {
    t = await createTestPayKit();
    // No payment method — will go through checkout
    const customer = await createTestCustomer({
      t,
      customer: {
        id: "test_checkout",
        email: "checkout@test.com",
        name: "Checkout Test",
      },
    });
    customerId = customer.customerId;
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it("subscribing without a payment method returns a checkout URL; completing it activates the plan", async () => {
    try {
      const beforeCheckout = new Date();

      const result = await t.paykit.subscribe({
        customerId,
        planId: "pro",
        successUrl: "https://example.com/success",
      });

      // Should return checkout URL (no payment method)
      if (!result.paymentUrl) {
        throw new Error("Expected checkout URL but got direct subscription");
      }

      await t.harness.completeCheckout(result.paymentUrl);

      await waitForActiveSubscription(t, customerId, 120_000, beforeCheckout, "pro");

      // Pro is active
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

      // Free is ended
      await expectProduct({
        database: t.database,
        customerId,
        planId: "free",
        expected: { status: "ended" },
      });

      // Subscription exists
      await expectSubscription({
        database: t.database,
        customerId,
        expected: { status: "active" },
      });
    } catch (error) {
      await dumpStateOnFailure(t.database, t.dbPath);
      throw error;
    }
  });
});

async function waitForActiveSubscription(
  t: TestPayKit,
  customerId: string,
  timeout: number,
  after: Date,
  planId: string,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const rows = await t.database
      .select({
        currentPeriodEndAt: subscription.currentPeriodEndAt,
        planId: product.id,
        providerData: subscription.providerData,
        startedAt: subscription.startedAt,
        status: subscription.status,
      })
      .from(subscription)
      .innerJoin(product, eq(product.internalId, subscription.productInternalId))
      .where(eq(subscription.customerId, customerId));

    if (
      rows.some(
        (row) =>
          row.status === "active" &&
          row.planId === planId &&
          row.currentPeriodEndAt !== null &&
          row.startedAt > after &&
          row.providerData !== null,
      )
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Timed out waiting for active checkout subscription");
}
