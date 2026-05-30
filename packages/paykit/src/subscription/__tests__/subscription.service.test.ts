import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { Customer } from "../../types/models";
import type { NormalizedSchema } from "../../types/schema";

const {
  getCustomerByIdOrThrow,
  upsertProviderCustomer,
  getDefaultPaymentMethod,
  getProductByHash,
  getProductByInternalId,
  getProductFeatures,
  getDefaultProductInGroup,
  getProductByProviderData,
  withProviderInfo,
} = vi.hoisted(() => ({
  getCustomerByIdOrThrow: vi.fn(),
  upsertProviderCustomer: vi.fn(),
  getDefaultPaymentMethod: vi.fn(),
  getProductByHash: vi.fn(),
  getProductByInternalId: vi.fn(),
  getProductFeatures: vi.fn(),
  getDefaultProductInGroup: vi.fn(),
  getProductByProviderData: vi.fn(),
  withProviderInfo: vi.fn(),
}));

vi.mock("../../customer/customer.service", () => ({
  findCustomerByProviderCustomerId: vi.fn(),
  getCustomerByIdOrThrow,
  upsertProviderCustomer,
}));

vi.mock("../../payment-method/payment-method.service", () => ({
  getDefaultPaymentMethod,
}));

vi.mock("../../product/product.service", () => ({
  getDefaultProductInGroup,
  getProductByHash,
  getProductByInternalId,
  getProductByProviderData,
  getProductFeatures,
  withProviderInfo,
}));

import { subscribeToPlan } from "../subscription.service";

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
    provider: {},
    updatedAt: now,
    ...overrides,
  };
}

function createSelectChain(result: unknown, terminalMethod: "where" | "orderBy" | "limit") {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
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

describe("subscription/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes customer details into subscription checkout", async () => {
    const customer = createCustomerRow({
      email: "billing@example.com",
      name: "Billing User",
    });
    const storedPlan = {
      group: "default",
      id: "pro",
      internalId: "product_internal_123",
      priceAmount: 1900,
      priceInterval: "month",
      providerProduct: { priceId: "price_123" },
    };
    const createSubscriptionCheckout = vi.fn().mockResolvedValue({
      paymentUrl: "https://checkout.example.com/session",
      providerCheckoutSessionId: "cs_123",
    });
    const warningSelect = createSelectChain([], "where");
    const activeSubscriptionSelect = createSelectChain([], "limit");
    const scheduledSubscriptionSelect = createSelectChain([], "orderBy");

    getCustomerByIdOrThrow.mockResolvedValue(customer);
    upsertProviderCustomer.mockResolvedValue({
      customerId: "customer_123",
      providerCustomer: { id: "cus_123" },
      providerCustomerId: "cus_123",
    });
    getDefaultPaymentMethod.mockResolvedValue(null);
    getProductByHash.mockResolvedValue({ id: "pro" });
    withProviderInfo.mockReturnValue(storedPlan);

    const ctx = {
      database: {
        select: vi
          .fn()
          .mockReturnValueOnce(warningSelect)
          .mockReturnValueOnce(activeSubscriptionSelect)
          .mockReturnValueOnce(scheduledSubscriptionSelect),
      },
      logger: {
        info: vi.fn(),
        trace: {
          run: vi.fn().mockImplementation(async (_label, fn) => fn()),
        },
        warn: vi.fn(),
      },
      options: {
        provider: {
          createAdapter: vi.fn(),
          id: "stripe",
          name: "Stripe",
        },
      },
      products: {
        ...emptyProducts,
        planMap: new Map([
          [
            "pro",
            {
              hash: "plan_hash_123",
              id: "pro",
              includes: [],
            },
          ],
        ]),
      },
      provider: {
        createSubscription: vi.fn(),
        createSubscriptionCheckout,
        id: "stripe",
        name: "Stripe",
      },
    } as unknown as PayKitContext;

    const result = await subscribeToPlan(ctx, {
      customerId: "customer_123",
      forceCheckout: true,
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    expect(result).toEqual({
      paymentUrl: "https://checkout.example.com/session",
      requiredAction: null,
    });
    expect(createSubscriptionCheckout).toHaveBeenCalledWith({
      cancelUrl: undefined,
      customer: {
        email: "billing@example.com",
        name: "Billing User",
      },
      metadata: {
        paykit_customer_id: "customer_123",
        paykit_intent: "subscribe",
        paykit_plan_id: "pro",
        paykit_product_internal_id: "product_internal_123",
      },
      providerCustomerId: "cus_123",
      providerProduct: { priceId: "price_123" },
      successUrl: "https://example.com/success",
    });
  });
});
