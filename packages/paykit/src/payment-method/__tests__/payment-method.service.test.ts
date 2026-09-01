import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { PayKitDatabase } from "../../database";
import type { NormalizedPaymentMethod } from "../../types/events";

const mocks = vi.hoisted(() => ({
  findCustomerByProviderCustomerId: vi.fn(),
}));

vi.mock("../../customer/customer.service", () => ({
  findCustomerByProviderCustomerId: mocks.findCustomerByProviderCustomerId,
}));

import {
  applyPaymentMethodWebhookAction,
  deletePaymentMethodByProviderId,
  getDefaultPaymentMethod,
  syncPaymentMethodByProviderCustomer,
} from "../payment-method.service";

const normalizedPaymentMethod: NormalizedPaymentMethod = {
  expiryMonth: 12,
  expiryYear: 2030,
  isDefault: true,
  last4: "4242",
  providerMethodId: "pm_123",
  type: "card",
};

function createWriteChain(result: unknown = undefined) {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockResolvedValue(result);
  const set = vi.fn().mockReturnValue({ where });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  return { onConflictDoUpdate, set, values, where };
}

describe("payment-method/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the customer's default active payment method", async () => {
    const storedMethod = { id: "payment_method_123" };
    const findFirst = vi.fn().mockResolvedValue(storedMethod);
    const database = {
      query: { paymentMethod: { findFirst } },
    } as unknown as PayKitDatabase;

    await expect(
      getDefaultPaymentMethod(database, { customerId: "customer_123", providerId: "stripe" }),
    ).resolves.toBe(storedMethod);
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it("does not persist methods for unknown customers", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue(null);
    const database = { transaction: vi.fn() } as unknown as PayKitDatabase;

    await expect(
      syncPaymentMethodByProviderCustomer(database, {
        paymentMethod: normalizedPaymentMethod,
        providerCustomerId: "cus_missing",
        providerId: "stripe",
      }),
    ).resolves.toBeNull();

    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("serializes default-method updates per customer", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue({ id: "customer_123" });
    const update = createWriteChain();
    const insert = createWriteChain();
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({ values: insert.values }),
      update: vi.fn().mockReturnValue({ set: update.set }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    } as unknown as PayKitDatabase;

    await expect(
      syncPaymentMethodByProviderCustomer(database, {
        paymentMethod: normalizedPaymentMethod,
        providerCustomerId: "cus_123",
        providerId: "stripe",
      }),
    ).resolves.toBe("customer_123");

    expect(tx.execute).toHaveBeenCalledOnce();
    expect(update.set).toHaveBeenCalledWith({ isDefault: false, updatedAt: expect.any(Date) });
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer_123",
        expiryMonth: 12,
        expiryYear: 2030,
        id: expect.stringMatching(/^pm_/),
        isDefault: true,
        last4: "4242",
        stripePaymentMethodId: "pm_123",
        type: "card",
      }),
    );
  });

  it("soft-deletes detached payment methods", async () => {
    const update = createWriteChain();
    const database = {
      update: vi.fn().mockReturnValue({ set: update.set }),
    } as unknown as PayKitDatabase;

    await deletePaymentMethodByProviderId(database, {
      providerId: "stripe",
      providerMethodId: "pm_123",
    });

    expect(update.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      isDefault: false,
      updatedAt: expect.any(Date),
    });
    expect(update.where).toHaveBeenCalledOnce();
  });

  it("returns the affected customer for upsert webhooks", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue({ id: "customer_123" });
    const update = createWriteChain();
    const insert = createWriteChain();
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({ values: insert.values }),
      update: vi.fn().mockReturnValue({ set: update.set }),
    };
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    } as unknown as PayKitDatabase;
    const ctx = { database, provider: { id: "stripe" } } as PayKitContext;

    await expect(
      applyPaymentMethodWebhookAction(ctx, {
        data: { paymentMethod: normalizedPaymentMethod, providerCustomerId: "cus_123" },
        type: "payment_method.upsert",
      }),
    ).resolves.toBe("customer_123");
    expect(mocks.findCustomerByProviderCustomerId).toHaveBeenCalledOnce();
  });
});
