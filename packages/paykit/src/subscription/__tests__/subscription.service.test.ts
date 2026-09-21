import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { StoredSubscription } from "../../types/models";
import type { NormalizedSchema } from "../../types/schema";

const {
  getDefaultProductInGroup,
  getProductByHash,
  getProductByInternalId,
  getProductByProviderData,
  getProductFeatures,
  withProviderInfo,
} = vi.hoisted(() => ({
  getDefaultProductInGroup: vi.fn(),
  getProductByHash: vi.fn(),
  getProductByInternalId: vi.fn(),
  getProductByProviderData: vi.fn(),
  getProductFeatures: vi.fn(),
  withProviderInfo: vi.fn(),
}));

vi.mock("../../product/product.service", () => ({
  getDefaultProductInGroup,
  getProductByHash,
  getProductByInternalId,
  getProductByProviderData,
  getProductFeatures,
  withProviderInfo,
}));

import { cancelPlanSubscription } from "../subscription.service";

const emptyProducts: NormalizedSchema = {
  features: [],
  plans: [],
  planMap: new Map(),
};

function createSelectChain(result: unknown, terminalMethod: "limit" | "orderBy") {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };

  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy =
    terminalMethod === "orderBy"
      ? vi.fn().mockResolvedValue(result)
      : vi.fn().mockReturnValue(chain);
  chain.limit = terminalMethod === "limit" ? vi.fn().mockResolvedValue(result) : vi.fn();

  return chain;
}

function createUpdateChain(result?: unknown) {
  const where = vi.fn().mockResolvedValue(result);
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

describe("subscription/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels the active subscription and schedules the default free plan", async () => {
    const activeSubscriptionRow = {
      subscription: {
        cancelAtPeriodEnd: false,
        canceled: false,
        canceledAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        currentPeriodEndAt: new Date("2024-02-01T00:00:00.000Z"),
        currentPeriodStartAt: new Date("2024-01-01T00:00:00.000Z"),
        customerId: "customer_123",
        endedAt: null,
        id: "sub_active",
        productInternalId: "product_pro_internal",
        providerData: {
          subscriptionId: "sub_provider_123",
        },
        providerId: "stripe",
        quantity: 1,
        scheduledProductId: null,
        startedAt: new Date("2024-01-01T00:00:00.000Z"),
        status: "active",
        trialEndsAt: null,
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      } satisfies StoredSubscription,
      product: {
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        currency: "usd",
        group: "default",
        hash: "pro_hash",
        id: "pro",
        internalId: "product_pro_internal",
        isDefault: false,
        name: "Pro",
        priceAmount: 1900,
        priceInterval: "month",
        provider: null,
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    };
    const activeSubscriptionSelect = createSelectChain([activeSubscriptionRow], "limit");
    const scheduledSubscriptionSelect = createSelectChain([], "orderBy");
    const insertReturning = vi.fn().mockResolvedValue([
      {
        id: "sub_free_scheduled",
      },
    ]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const cancelUpdate = createUpdateChain();
    const scheduleUpdate = createUpdateChain();

    getProductByHash.mockResolvedValue({ id: "pro" });
    withProviderInfo.mockReturnValue({
      group: "default",
      id: "pro",
      internalId: "product_pro_internal",
      priceAmount: 1900,
      priceInterval: "month",
      providerProduct: { priceId: "price_pro_123" },
    });
    getDefaultProductInGroup.mockResolvedValue({
      id: "free",
      internalId: "product_free_internal",
      priceAmount: null,
    });

    const tx = {
      insert,
      query: {
        subscription: {
          findFirst: vi.fn().mockResolvedValue(activeSubscriptionRow.subscription),
        },
      },
      select: vi.fn().mockReturnValue(scheduledSubscriptionSelect),
      update: vi.fn().mockReturnValueOnce({ set: cancelUpdate.set }).mockReturnValueOnce({
        set: scheduleUpdate.set,
      }),
    };

    const providerCancel = vi.fn().mockResolvedValue({
      paymentUrl: null,
      subscription: null,
    });
    const ctx = {
      database: {
        select: vi.fn().mockReturnValue(activeSubscriptionSelect),
        transaction: vi.fn().mockImplementation(async (callback) => callback(tx)),
      },
      logger: {
        info: vi.fn(),
        trace: {
          run: vi.fn().mockImplementation(async (_label, fn) => fn()),
        },
      },
      products: {
        ...emptyProducts,
        planMap: new Map([
          [
            "pro",
            {
              hash: "pro_hash",
              id: "pro",
              includes: [],
            },
          ],
          [
            "free",
            {
              hash: "free_hash",
              id: "free",
              includes: [],
            },
          ],
        ]),
      },
      provider: {
        cancelSubscription: providerCancel,
        id: "stripe",
        name: "Stripe",
      },
    } as unknown as PayKitContext;

    const result = await cancelPlanSubscription(ctx, {
      customerId: "customer_123",
      planId: "pro",
    });

    expect(result).toEqual({
      paymentUrl: null,
      requiredAction: null,
    });
    expect(providerCancel).toHaveBeenCalledWith({
      currentPeriodEndAt: new Date("2024-02-01T00:00:00.000Z"),
      providerSubscriptionId: "sub_provider_123",
      providerSubscriptionScheduleId: null,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer_123",
        productInternalId: "product_free_internal",
        status: "scheduled",
      }),
    );
    expect(cancelUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        canceled: true,
      }),
    );
    expect(scheduleUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledProductId: "product_free_internal",
      }),
    );
  });
});
