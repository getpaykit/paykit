import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import { PAYKIT_ERROR_CODES } from "../../core/errors";
import type { PayKitDatabase } from "../../database";
import type { StoredInvoice } from "../../types/models";

const mocks = vi.hoisted(() => ({
  findCustomerByProviderCustomerId: vi.fn(),
}));

vi.mock("../../customer/customer.service", () => ({
  findCustomerByProviderCustomerId: mocks.findCustomerByProviderCustomerId,
}));

import { applyInvoiceWebhookAction, upsertInvoiceRecord } from "../invoice.service";

const normalizedInvoice = {
  currency: "usd",
  hostedUrl: "https://example.com/invoice",
  periodEndAt: new Date("2026-02-01T00:00:00.000Z"),
  periodStartAt: new Date("2026-01-01T00:00:00.000Z"),
  providerInvoiceId: "in_123",
  status: "paid",
  totalAmount: 2900,
};

function createInsertChain(result: StoredInvoice[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  return { onConflictDoUpdate, returning, values };
}

describe("invoice/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts an invoice by provider invoice ID", async () => {
    const storedInvoice = { id: "inv_123" } as StoredInvoice;
    const insert = createInsertChain([storedInvoice]);
    const database = {
      insert: vi.fn().mockReturnValue({ values: insert.values }),
    } as unknown as PayKitDatabase;

    await expect(
      upsertInvoiceRecord(database, {
        customerId: "customer_123",
        invoice: normalizedInvoice,
        providerId: "stripe",
        subscriptionId: "subscription_123",
      }),
    ).resolves.toBe(storedInvoice);

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2900,
        currency: "usd",
        customerId: "customer_123",
        id: expect.stringMatching(/^inv_/),
        status: "paid",
        stripeInvoiceId: "in_123",
        subscriptionId: "subscription_123",
      }),
    );
    expect(insert.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ stripeInvoiceId: "in_123" }) }),
    );
  });

  it("throws when the invoice upsert returns no row", async () => {
    const insert = createInsertChain([]);
    const database = {
      insert: vi.fn().mockReturnValue({ values: insert.values }),
    } as unknown as PayKitDatabase;

    await expect(
      upsertInvoiceRecord(database, {
        customerId: "customer_123",
        invoice: normalizedInvoice,
        providerId: "stripe",
      }),
    ).rejects.toMatchObject({ code: PAYKIT_ERROR_CODES.INVOICE_UPSERT_FAILED.code });
  });

  it("ignores webhook invoices for unknown customers", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue(null);
    const database = { insert: vi.fn() } as unknown as PayKitDatabase;
    const ctx = { database, provider: { id: "stripe" } } as PayKitContext;

    await expect(
      applyInvoiceWebhookAction(ctx, {
        data: { invoice: normalizedInvoice, providerCustomerId: "cus_missing" },
        type: "invoice.upsert",
      }),
    ).resolves.toBeNull();
    expect(database.insert).not.toHaveBeenCalled();
  });

  it("links webhook invoices to a known subscription", async () => {
    mocks.findCustomerByProviderCustomerId.mockResolvedValue({ id: "customer_123" });
    const storedInvoice = { id: "inv_123" } as StoredInvoice;
    const insert = createInsertChain([storedInvoice]);
    const database = {
      insert: vi.fn().mockReturnValue({ values: insert.values }),
      query: {
        subscription: {
          findFirst: vi.fn().mockResolvedValue({ id: "subscription_123" }),
        },
      },
    } as unknown as PayKitDatabase;
    const ctx = { database, provider: { id: "stripe" } } as PayKitContext;

    await expect(
      applyInvoiceWebhookAction(ctx, {
        data: {
          invoice: normalizedInvoice,
          providerCustomerId: "cus_123",
          providerSubscriptionId: "sub_123",
        },
        type: "invoice.upsert",
      }),
    ).resolves.toBe("customer_123");
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: "subscription_123" }),
    );
  });
});
