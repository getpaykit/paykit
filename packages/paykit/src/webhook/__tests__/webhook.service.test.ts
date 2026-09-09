import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { PayKitDatabase } from "../../database";
import type { AnyNormalizedWebhookEvent } from "../../types/events";

const mocks = vi.hoisted(() => ({
  applyInvoiceWebhookAction: vi.fn(),
  applyPaymentMethodWebhookAction: vi.fn(),
  applyPaymentWebhookAction: vi.fn(),
  applySubscriptionWebhookAction: vi.fn(),
  emitCustomerUpdated: vi.fn(),
  generateId: vi.fn((prefix: string) => `${prefix}_123`),
  handleSubscribeCheckoutCompleted: vi.fn(),
  prepareSubscribeCheckoutCompleted: vi.fn(),
}));

vi.mock("../../core/utils", () => ({ generateId: mocks.generateId }));
vi.mock("../../customer/customer.service", () => ({
  emitCustomerUpdated: mocks.emitCustomerUpdated,
}));
vi.mock("../../invoice/invoice.service", () => ({
  applyInvoiceWebhookAction: mocks.applyInvoiceWebhookAction,
}));
vi.mock("../../payment-method/payment-method.service", () => ({
  applyPaymentMethodWebhookAction: mocks.applyPaymentMethodWebhookAction,
}));
vi.mock("../../payment/payment.service", () => ({
  applyPaymentWebhookAction: mocks.applyPaymentWebhookAction,
}));
vi.mock("../../subscription/subscription.service", () => ({
  applySubscriptionWebhookAction: mocks.applySubscriptionWebhookAction,
  handleSubscribeCheckoutCompleted: mocks.handleSubscribeCheckoutCompleted,
  prepareSubscribeCheckoutCompleted: mocks.prepareSubscribeCheckoutCompleted,
}));

import { handleWebhook } from "../webhook.service";

const invoiceEvent = {
  actions: [
    {
      data: {
        invoice: {
          currency: "usd",
          providerInvoiceId: "in_123",
          status: "paid",
          totalAmount: 2900,
        },
        providerCustomerId: "cus_123",
      },
      type: "invoice.upsert",
    },
  ],
  name: "invoice.updated",
  payload: {
    invoice: {
      currency: "usd",
      providerInvoiceId: "in_123",
      status: "paid",
      totalAmount: 2900,
    },
    providerCustomerId: "cus_123",
    providerEventId: "evt_provider_123",
  },
} satisfies AnyNormalizedWebhookEvent;

function createUpdateChain(returningResult: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returningResult);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { returning, set, where };
}

function createContext(input?: { insertError?: unknown; retryResult?: unknown[] }) {
  const insertValues = input?.insertError
    ? vi.fn().mockRejectedValue(input.insertError)
    : vi.fn().mockResolvedValue(undefined);
  const retryUpdate = createUpdateChain(input?.retryResult);
  const transactionUpdate = createUpdateChain();
  const tx = {
    execute: vi.fn().mockResolvedValue({
      rows: [{ status: "processing", trace_id: "claim_123" }],
    }),
    update: vi.fn().mockReturnValue({ set: transactionUpdate.set }),
  };
  const database = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    update: vi.fn().mockReturnValue({ set: retryUpdate.set }),
  } as unknown as PayKitDatabase;
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    trace: { run: vi.fn((_name: string, callback: () => unknown) => callback()) },
  };
  const provider = { handleWebhook: vi.fn().mockResolvedValue([invoiceEvent]), id: "stripe" };

  return {
    ctx: { database, logger, provider } as unknown as PayKitContext,
    database,
    insertValues,
    provider,
    retryUpdate,
    transactionUpdate,
    tx,
  };
}

describe("webhook/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyInvoiceWebhookAction.mockResolvedValue("customer_123");
  });

  it("claims, applies, and completes a provider event", async () => {
    const { ctx, insertValues, provider, transactionUpdate, tx } = createContext();

    await expect(
      handleWebhook(ctx, { body: "{}", headers: { "stripe-signature": "signature" } }),
    ).resolves.toEqual({ received: true });

    expect(provider.handleWebhook).toHaveBeenCalledWith({
      allowUnsignedPayload: undefined,
      body: "{}",
      headers: { "stripe-signature": "signature" },
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        stripeEventId: "evt_provider_123",
        traceId: "claim_123",
        type: "invoice.updated",
      }),
    );
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(mocks.applyInvoiceWebhookAction).toHaveBeenCalledOnce();
    expect(transactionUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ error: null, status: "processed" }),
    );
    expect(mocks.emitCustomerUpdated).toHaveBeenCalledWith(ctx, "customer_123");
  });

  it("skips a duplicate event with an active claim", async () => {
    const duplicateError = Object.assign(new Error("duplicate"), { code: "23505" });
    const { ctx, database, retryUpdate } = createContext({ insertError: duplicateError });

    await expect(handleWebhook(ctx, { body: "{}", headers: {} })).resolves.toEqual({
      received: true,
    });

    expect(retryUpdate.returning).toHaveBeenCalledOnce();
    expect(database.transaction).not.toHaveBeenCalled();
    expect(mocks.applyInvoiceWebhookAction).not.toHaveBeenCalled();
  });

  it("reclaims a retryable failed event", async () => {
    const duplicateError = Object.assign(new Error("duplicate"), { code: "23505" });
    const { ctx, database } = createContext({
      insertError: duplicateError,
      retryResult: [{ id: "evt_123" }],
    });

    await expect(handleWebhook(ctx, { body: "{}", headers: {} })).resolves.toEqual({
      received: true,
    });

    expect(database.transaction).toHaveBeenCalledOnce();
    expect(mocks.applyInvoiceWebhookAction).toHaveBeenCalledOnce();
  });

  it("records processing failures before rethrowing", async () => {
    const processingError = new Error("invoice persistence failed");
    mocks.applyInvoiceWebhookAction.mockRejectedValue(processingError);
    const { ctx, database, retryUpdate } = createContext();

    await expect(handleWebhook(ctx, { body: "{}", headers: {} })).rejects.toBe(processingError);

    expect(database.update).toHaveBeenCalledOnce();
    expect(retryUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("invoice persistence failed"),
        status: "failed",
      }),
    );
    expect(mocks.emitCustomerUpdated).not.toHaveBeenCalled();
  });

  it("does not treat unexpected insertion errors as duplicates", async () => {
    const databaseError = Object.assign(new Error("connection lost"), { code: "08006" });
    const { ctx, database } = createContext({ insertError: databaseError });

    await expect(handleWebhook(ctx, { body: "{}", headers: {} })).rejects.toBe(databaseError);
    expect(database.update).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
