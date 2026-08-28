import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { PayKitDatabase } from "../../database";
import type { NormalizedPayment } from "../../types/events";

const mocks = vi.hoisted(() => ({
  findCustomerByProviderCustomerId: vi.fn(),
}));

vi.mock("../../customer/customer.service", () => ({
  findCustomerByProviderCustomerId: mocks.findCustomerByProviderCustomerId,
}));

import { applyPaymentWebhookAction, syncPaymentByProviderCustomer } from "../payment.service";

const normalizedPayment: NormalizedPayment = {
  amount: 2900,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  currency: "usd",
  description: "Pro subscription",
  providerMethodId: "pm_123",
  providerPaymentId: "pi_123",
  status: "succeeded",
};

function createInsertChain() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  return { onConflictDoUpdate, values };
}

describe("payment/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not persist payments for unknown customers", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue(null);
    const database = { insert: vi.fn() } as unknown as PayKitDatabase;

    await expect(
      syncPaymentByProviderCustomer(database, {
        payment: normalizedPayment,
        providerCustomerId: "cus_missing",
        providerId: "stripe",
      }),
    ).resolves.toBeNull();

    expect(database.insert).not.toHaveBeenCalled();
  });

  it("upserts a charge invoice by provider payment ID", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue({ id: "customer_123" });
    const insert = createInsertChain();
    const database = {
      insert: vi.fn().mockReturnValue({ values: insert.values }),
    } as unknown as PayKitDatabase;

    await expect(
      syncPaymentByProviderCustomer(database, {
        payment: normalizedPayment,
        providerCustomerId: "cus_123",
        providerId: "stripe",
      }),
    ).resolves.toBe("customer_123");

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2900,
        currency: "usd",
        customerId: "customer_123",
        description: "Pro subscription",
        id: expect.stringMatching(/^inv_/),
        status: "succeeded",
        stripePaymentId: "pi_123",
        stripePaymentMethodId: "pm_123",
        type: "charge",
      }),
    );
    expect(insert.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ stripePaymentId: "pi_123" }) }),
    );
  });

  it("returns the affected customer for webhook notifications", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue({ id: "customer_123" });
    const insert = createInsertChain();
    const database = {
      insert: vi.fn().mockReturnValue({ values: insert.values }),
    } as unknown as PayKitDatabase;
    const ctx = { database, provider: { id: "stripe" } } as PayKitContext;

    await expect(
      applyPaymentWebhookAction(ctx, {
        data: { payment: normalizedPayment, providerCustomerId: "cus_123" },
        type: "payment.upsert",
      }),
    ).resolves.toBe("customer_123");
    expect(mocks.findCustomerByProviderCustomerId).toHaveBeenCalledOnce();
  });
});
