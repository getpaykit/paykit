import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { Customer } from "../../types/models";
import type { NormalizedSchema } from "../../types/schema";
import { getCustomerWithDetails, listCustomers, upsertCustomer } from "../customer.service";

const emptyProducts: NormalizedSchema = {
  features: [],
  plans: [],
  planMap: new Map(),
};

function createCustomerRow(overrides: Partial<Customer> = {}): Customer {
  const now = new Date("2024-01-01T00:00:00.000Z");

  return {
    createdAt: now,
    deletedAt: null,
    email: null,
    id: "customer_123",
    metadata: null,
    name: null,
    stripeCustomerId: null,
    stripeFrozenTime: null,
    stripeSyncedEmail: null,
    stripeSyncedMetadata: null,
    stripeSyncedName: null,
    stripeTestClockId: null,
    updatedAt: now,
    ...overrides,
  };
}

function createUpdateChain(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { returning, set, where };
}

const createSelectChain = (result: unknown, terminalMethod: "orderBy" | "where") => {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };

  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where =
    terminalMethod === "where" ? vi.fn().mockResolvedValue(result) : vi.fn().mockReturnValue(chain);
  chain.orderBy = terminalMethod === "orderBy" ? vi.fn().mockResolvedValue(result) : vi.fn();

  return chain;
};

describe("customer/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provisions and stores a provider customer on upsert", async () => {
    const syncedCustomer = createCustomerRow({
      email: "test@example.com",
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    });
    const syncUpdate = createUpdateChain([syncedCustomer]);
    const providerUpdate = createUpdateChain(undefined);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(createCustomerRow())
      .mockResolvedValueOnce(syncedCustomer)
      .mockResolvedValueOnce(syncedCustomer);
    const stripe = {
      advanceTestClock: vi.fn(),
      attachPaymentMethod: vi.fn(),
      cancelSubscription: vi.fn(),
      createInvoice: vi.fn(),
      createPortalSession: vi.fn(),
      createSubscription: vi.fn(),
      createSubscriptionCheckout: vi.fn(),
      deleteCustomer: vi.fn(),
      detachPaymentMethod: vi.fn(),
      getTestClock: vi.fn(),
      handleWebhook: vi.fn(),
      listActiveSubscriptions: vi.fn(),
      resumeSubscription: vi.fn(),
      scheduleSubscriptionChange: vi.fn(),
      syncProducts: vi.fn(),
      updateSubscription: vi.fn(),
      createCustomer: vi.fn().mockResolvedValue({
        providerCustomer: {
          frozenTime: "2024-01-01T00:00:00.000Z",
          id: "cus_123",
          testClockId: "clock_123",
        },
      }),
      updateCustomer: vi.fn(),
    };
    const ctx = {
      database: {
        query: {
          customer: {
            findFirst,
          },
        },
        update: vi
          .fn()
          .mockReturnValueOnce({ set: syncUpdate.set })
          .mockReturnValueOnce({ set: providerUpdate.set }),
      },
      logger: {
        warn: vi.fn(),
      },
      options: {
        stripe: { secretKey: "sk_test_123", webhookSecret: "whsec_123" },
        testing: { enabled: true },
      },
      products: emptyProducts,
      provider: {
        id: "stripe",
        name: "Stripe",
        ...stripe,
      },
    } as unknown as PayKitContext;

    const customer = await upsertCustomer(ctx, {
      email: "test@example.com",
      id: "customer_123",
      upsertProviderCustomer: true,
    });

    expect(customer).toEqual(syncedCustomer);
    expect(stripe.createCustomer).toHaveBeenCalledWith({
      createTestClock: true,
      email: "test@example.com",
      id: "customer_123",
      metadata: undefined,
      name: undefined,
    });
    expect(providerUpdate.set).toHaveBeenCalledWith({
      stripeCustomerId: "cus_123",
      stripeFrozenTime: expect.any(Date),
      stripeSyncedEmail: "test@example.com",
      stripeSyncedMetadata: null,
      stripeSyncedName: null,
      stripeTestClockId: "clock_123",
      updatedAt: expect.any(Date),
    });
  });

  it("provisions provider customer in production mode without test clock", async () => {
    const syncedCustomer = createCustomerRow({
      email: "prod@example.com",
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    });
    const syncUpdate = createUpdateChain([syncedCustomer]);
    const providerUpdate = createUpdateChain(undefined);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(createCustomerRow())
      .mockResolvedValueOnce(syncedCustomer)
      .mockResolvedValueOnce(syncedCustomer);
    const stripe = {
      advanceTestClock: vi.fn(),
      attachPaymentMethod: vi.fn(),
      cancelSubscription: vi.fn(),
      createInvoice: vi.fn(),
      createPortalSession: vi.fn(),
      createSubscription: vi.fn(),
      createSubscriptionCheckout: vi.fn(),
      deleteCustomer: vi.fn(),
      detachPaymentMethod: vi.fn(),
      getTestClock: vi.fn(),
      handleWebhook: vi.fn(),
      listActiveSubscriptions: vi.fn(),
      resumeSubscription: vi.fn(),
      scheduleSubscriptionChange: vi.fn(),
      syncProducts: vi.fn(),
      updateSubscription: vi.fn(),
      createCustomer: vi.fn().mockResolvedValue({
        providerCustomer: {
          id: "cus_456",
        },
      }),
      updateCustomer: vi.fn(),
    };
    const ctx = {
      database: {
        query: {
          customer: {
            findFirst,
          },
        },
        update: vi
          .fn()
          .mockReturnValueOnce({ set: syncUpdate.set })
          .mockReturnValueOnce({ set: providerUpdate.set }),
      },
      logger: {
        warn: vi.fn(),
      },
      options: {
        stripe: { secretKey: "sk_test_123", webhookSecret: "whsec_123" },
      },
      products: emptyProducts,
      provider: {
        id: "stripe",
        name: "Stripe",
        ...stripe,
      },
    } as unknown as PayKitContext;

    await upsertCustomer(ctx, {
      email: "prod@example.com",
      id: "customer_123",
      upsertProviderCustomer: true,
    });

    expect(stripe.createCustomer).toHaveBeenCalledWith({
      createTestClock: false,
      email: "prod@example.com",
      id: "customer_123",
      metadata: undefined,
      name: undefined,
    });
  });

  it("aggregates stacked feature entitlements when loading a customer", async () => {
    const subSelect = createSelectChain(
      [
        {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date("2024-02-01T00:00:00.000Z"),
          currentPeriodStart: new Date("2024-01-01T00:00:00.000Z"),
          planGroup: "default",
          planId: "pro",
          status: "active",
        },
      ],
      "orderBy",
    );
    const entSelect = createSelectChain(
      [
        {
          balance: 3,
          featureId: "feature_api_calls",
          limit: 5,
          nextResetAt: new Date("2024-02-01T00:00:00.000Z"),
        },
        {
          balance: 4,
          featureId: "feature_api_calls",
          limit: 10,
          nextResetAt: new Date("2024-01-15T00:00:00.000Z"),
        },
      ],
      "where",
    );
    const ctx = {
      database: {
        query: {
          customer: {
            findFirst: vi.fn().mockResolvedValue(createCustomerRow()),
          },
        },
        select: vi.fn().mockReturnValueOnce(subSelect).mockReturnValueOnce(entSelect),
      },
      logger: {
        warn: vi.fn(),
      },
    } as unknown as PayKitContext;

    const customer = await getCustomerWithDetails(ctx, "customer_123");

    expect(customer?.entitlements.feature_api_calls).toEqual({
      balance: 7,
      featureId: "feature_api_calls",
      limit: 15,
      nextResetAt: new Date("2024-01-15T00:00:00.000Z"),
      unlimited: false,
      usage: 8,
    });
  });

  it("aggregates stacked feature entitlements when listing customers", async () => {
    const countSelect = createSelectChain([{ count: 1 }], "where");
    const subSelect = createSelectChain(
      [
        {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date("2024-02-01T00:00:00.000Z"),
          currentPeriodStart: new Date("2024-01-01T00:00:00.000Z"),
          customerId: "customer_123",
          planId: "pro",
          status: "active",
        },
      ],
      "orderBy",
    );
    const entSelect = createSelectChain(
      [
        {
          balance: 2,
          customerId: "customer_123",
          featureId: "feature_api_calls",
          limit: 4,
          nextResetAt: new Date("2024-03-01T00:00:00.000Z"),
        },
        {
          balance: 5,
          customerId: "customer_123",
          featureId: "feature_api_calls",
          limit: 6,
          nextResetAt: new Date("2024-02-15T00:00:00.000Z"),
        },
      ],
      "where",
    );
    const customerRow = createCustomerRow();
    const ctx = {
      database: {
        query: {
          customer: {
            findMany: vi.fn().mockResolvedValue([customerRow]),
          },
        },
        select: vi
          .fn()
          .mockReturnValueOnce(countSelect)
          .mockReturnValueOnce(subSelect)
          .mockReturnValueOnce(entSelect),
      },
    } as unknown as PayKitContext;

    const result = await listCustomers(ctx);

    expect(result.data[0]?.entitlements.feature_api_calls).toEqual({
      balance: 7,
      featureId: "feature_api_calls",
      limit: 10,
      nextResetAt: new Date("2024-02-15T00:00:00.000Z"),
      unlimited: false,
      usage: 3,
    });
  });

  it("skips provider call when snapshot matches current customer data", async () => {
    const existingCustomer = createCustomerRow({
      email: "same@example.com",
      name: "Same",
      stripeCustomerId: "cus_existing",
      stripeSyncedEmail: "same@example.com",
      stripeSyncedMetadata: null,
      stripeSyncedName: "Same",
    });
    const syncUpdate = createUpdateChain([existingCustomer]);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(existingCustomer)
      .mockResolvedValueOnce(existingCustomer);
    const providerMock = {
      id: "stripe",
      name: "Stripe",
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
    };
    const ctx = {
      database: {
        query: { customer: { findFirst } },
        update: vi.fn().mockReturnValueOnce({ set: syncUpdate.set }),
      },
      logger: { warn: vi.fn() },
      options: {
        provider: { id: "stripe", name: "Stripe", createAdapter: vi.fn() },
      },
      products: emptyProducts,
      provider: providerMock,
    } as unknown as PayKitContext;

    const result = await upsertCustomer(ctx, {
      email: "same@example.com",
      id: "customer_123",
      upsertProviderCustomer: true,
    });

    expect(providerMock.createCustomer).not.toHaveBeenCalled();
    expect(providerMock.updateCustomer).not.toHaveBeenCalled();
    expect(result.stripeCustomerId).toBe("cus_existing");
  });

  it("calls provider when email changes from snapshot", async () => {
    const existingCustomer = createCustomerRow({
      email: "new@example.com",
      name: "Same",
      stripeCustomerId: "cus_existing",
      stripeSyncedEmail: "old@example.com",
      stripeSyncedMetadata: null,
      stripeSyncedName: "Same",
    });
    const syncUpdate = createUpdateChain([existingCustomer]);
    const providerUpdate = createUpdateChain(undefined);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(createCustomerRow({ email: "old@example.com" }))
      .mockResolvedValueOnce(existingCustomer)
      .mockResolvedValueOnce(existingCustomer);
    const providerMock = {
      id: "stripe",
      name: "Stripe",
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
    };
    const ctx = {
      database: {
        query: { customer: { findFirst } },
        update: vi
          .fn()
          .mockReturnValueOnce({ set: syncUpdate.set })
          .mockReturnValueOnce({ set: providerUpdate.set }),
      },
      logger: { warn: vi.fn() },
      options: {
        provider: { id: "stripe", name: "Stripe", createAdapter: vi.fn() },
      },
      products: emptyProducts,
      provider: providerMock,
    } as unknown as PayKitContext;

    await upsertCustomer(ctx, {
      email: "new@example.com",
      id: "customer_123",
      upsertProviderCustomer: true,
    });

    expect(providerMock.updateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ providerCustomerId: "cus_existing", email: "new@example.com" }),
    );
  });

  it("calls provider when no snapshot exists (first sync)", async () => {
    const existingCustomer = createCustomerRow({
      email: "test@example.com",
      stripeCustomerId: "cus_existing",
    });
    const syncUpdate = createUpdateChain([existingCustomer]);
    const providerUpdate = createUpdateChain(undefined);
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(createCustomerRow())
      .mockResolvedValueOnce(existingCustomer)
      .mockResolvedValueOnce(existingCustomer);
    const providerMock = {
      id: "stripe",
      name: "Stripe",
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
    };
    const ctx = {
      database: {
        query: { customer: { findFirst } },
        update: vi
          .fn()
          .mockReturnValueOnce({ set: syncUpdate.set })
          .mockReturnValueOnce({ set: providerUpdate.set }),
      },
      logger: { warn: vi.fn() },
      options: {
        provider: { id: "stripe", name: "Stripe", createAdapter: vi.fn() },
      },
      products: emptyProducts,
      provider: providerMock,
    } as unknown as PayKitContext;

    await upsertCustomer(ctx, {
      email: "test@example.com",
      id: "customer_123",
      upsertProviderCustomer: true,
    });

    expect(providerMock.updateCustomer).toHaveBeenCalled();
    expect(providerUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: "cus_existing",
        stripeSyncedEmail: "test@example.com",
      }),
    );
  });
});
