import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: {
    findCustomerByProviderCustomerId: vi.fn(),
    upsertProviderCustomer: vi.fn(),
  },
  paymentMethod: {
    getDefaultPaymentMethod: vi.fn(),
  },
  product: {
    getDefaultProductInGroup: vi.fn(),
    getProductByInternalId: vi.fn(),
    getProductByPlan: vi.fn(),
    getProductByProviderData: vi.fn(),
    getProductFeatures: vi.fn(),
    withProviderInfo: vi.fn(),
  },
}));

vi.mock("../../customer/customer.service", () => mocks.customer);
vi.mock("../../payment-method/payment-method.service", () => mocks.paymentMethod);
vi.mock("../../product/product.service", () => mocks.product);

import type { PayKitContext } from "../../core/context";
import type { PayKitDatabase } from "../../database";
import {
  subscribeToPlan,
  syncSubscriptionBillingState,
  syncSubscriptionFromProvider,
} from "../subscription.service";

const now = new Date("2024-01-01T00:00:00.000Z");

function createUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

function createSelectChain(result: unknown, terminalMethod: "limit" | "orderBy" | "where") {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where =
    terminalMethod === "where" ? vi.fn().mockResolvedValue(result) : vi.fn().mockReturnValue(chain);
  chain.orderBy =
    terminalMethod === "orderBy"
      ? vi.fn().mockResolvedValue(result)
      : vi.fn().mockReturnValue(chain);
  chain.limit = terminalMethod === "limit" ? vi.fn().mockResolvedValue(result) : vi.fn();
  return chain;
}

function createProductRow() {
  return {
    createdAt: now,
    group: "default",
    hash: "hash_123",
    id: "restaurant-live",
    internalId: "prod_internal_123",
    isDefault: false,
    name: "Restaurant Live",
    priceAmount: 900,
    priceCurrency: "eur",
    priceInterval: "month",
    stripePriceId: "price_123",
    stripeProductId: "prod_123",
    updatedAt: now,
    version: 1,
  };
}

function createSubscriptionRow(quantity = 3) {
  return {
    cancelAtPeriodEnd: false,
    canceled: false,
    canceledAt: null,
    createdAt: now,
    currentPeriodEndAt: null,
    currentPeriodStartAt: null,
    customerId: "cust_123",
    endedAt: null,
    id: "sub_local_123",
    productInternalId: "prod_internal_123",
    quantity,
    scheduledProductId: null,
    startedAt: now,
    status: "active",
    stripeSubscriptionId: "sub_123",
    stripeSubscriptionScheduleId: null,
    trialEndsAt: null,
    updatedAt: now,
  };
}

function createSamePlanSubscribeContext() {
  const product = createProductRow();
  const activeSubscription = createSubscriptionRow(3);
  const selectResults = [
    createSelectChain([], "where"),
    createSelectChain([{ product, subscription: activeSubscription }], "limit"),
    createSelectChain([], "orderBy"),
  ];
  const database = {
    select: vi.fn(() => selectResults.shift()),
  } as unknown as PayKitDatabase;
  const provider = {
    id: "stripe",
    name: "Stripe",
    resumeSubscription: vi.fn(),
    updateSubscription: vi.fn(),
  };
  const trace = vi.fn() as unknown as PayKitContext["logger"]["trace"];
  trace.run = (_prefix, callback) => callback();
  const ctx = {
    database,
    logger: { info: vi.fn(), trace, warn: vi.fn() },
    options: {},
    products: {
      planMap: new Map([
        [
          "restaurant-live",
          {
            group: "default",
            hash: "hash_123",
            id: "restaurant-live",
            includes: [],
            isDefault: false,
            name: "Restaurant Live",
            price: { amount: 900, currency: "eur", interval: "month" },
          },
        ],
      ]),
    },
    provider,
  } as unknown as PayKitContext;

  mocks.customer.upsertProviderCustomer.mockResolvedValue({
    customerId: "cust_123",
    providerCustomer: { id: "cus_123" },
    providerCustomerId: "cus_123",
  });
  mocks.paymentMethod.getDefaultPaymentMethod.mockResolvedValue({ id: "pm_123" });
  mocks.product.getProductByPlan.mockResolvedValue(product);
  mocks.product.withProviderInfo.mockReturnValue({
    ...product,
    providerProduct: { priceId: "price_123", productId: "prod_123" },
  });

  return { ctx, provider };
}

describe("subscription/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not reset same-plan quantity when quantity is omitted", async () => {
    const { ctx, provider } = createSamePlanSubscribeContext();

    await subscribeToPlan(ctx, {
      customerId: "cust_123",
      planId: "restaurant-live",
      successUrl: "https://app.example.com/success",
    });

    expect(provider.updateSubscription).not.toHaveBeenCalled();
    expect(provider.resumeSubscription).not.toHaveBeenCalled();
  });

  it("syncs provider subscription quantity into the local subscription", async () => {
    const update = createUpdateChain();
    const database = {
      update: vi.fn().mockReturnValue({ set: update.set }),
    } as unknown as PayKitDatabase;

    await syncSubscriptionFromProvider(database, {
      providerSubscription: {
        cancelAtPeriodEnd: false,
        providerSubscriptionId: "sub_123",
        quantity: 3,
        status: "active",
      },
      subscriptionId: "sub_local_123",
    });

    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });

  it("syncs explicit billing state quantity without resetting existing quantity", async () => {
    const update = createUpdateChain();
    const database = {
      query: {
        subscription: {
          findFirst: vi.fn().mockResolvedValue({
            currentPeriodEndAt: null,
            currentPeriodStartAt: null,
            id: "sub_local_123",
            quantity: 1,
            startedAt: null,
            status: "active",
            stripeSubscriptionId: "sub_123",
            stripeSubscriptionScheduleId: null,
          }),
        },
      },
      update: vi.fn().mockReturnValue({ set: update.set }),
    } as unknown as PayKitDatabase;

    await syncSubscriptionBillingState(database, {
      quantity: 4,
      subscriptionId: "sub_local_123",
    });

    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 4 }));
  });
});
