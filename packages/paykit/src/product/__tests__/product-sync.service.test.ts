import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import type { StoredProduct, StoredProductFeature } from "../../types/models";
import type { NormalizedPlan } from "../../types/schema";
import { dryRunSyncProducts, syncProducts } from "../product-sync.service";

const service = vi.hoisted(() => ({
  archiveProductsByIds: vi.fn(),
  getLatestProductSnapshot: vi.fn(),
  getProviderProduct: vi.fn(),
  insertProductVersion: vi.fn(),
  listLatestActiveProducts: vi.fn(),
  replaceProductFeatures: vi.fn(),
  restoreProduct: vi.fn(),
  updateProductName: vi.fn(),
  upsertFeature: vi.fn(),
  upsertProviderProduct: vi.fn(),
}));

vi.mock("../product.service", () => service);

function createPlan(overrides: Partial<NormalizedPlan> = {}): NormalizedPlan {
  return {
    group: "base",
    hash: "hash_pro",
    id: "pro",
    includes: [],
    isDefault: false,
    name: "Pro",
    priceAmount: 2_000,
    priceInterval: "month",
    trialDays: null,
    ...overrides,
  };
}

function createProduct(overrides: Partial<StoredProduct> = {}): StoredProduct {
  const now = new Date("2024-01-01T00:00:00.000Z");

  return {
    archivedAt: null,
    createdAt: now,
    group: "base",
    hash: "hash_pro",
    id: "pro",
    internalId: "prod_internal_123",
    isDefault: false,
    name: "Pro",
    priceAmount: 2_000,
    priceInterval: "month",
    provider: {},
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

function createContext(plans: readonly NormalizedPlan[] = []): PayKitContext {
  return {
    database: {},
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    options: {},
    plans: {
      features: [],
      planMap: new Map(plans.map((plan) => [plan.id, plan])),
      plans,
    },
    provider: {
      archiveProduct: vi.fn(),
      id: "stripe",
      name: "Stripe",
      syncProduct: vi
        .fn()
        .mockResolvedValue({ providerPriceId: "price_123", providerProductId: "prod_123" }),
    },
  } as unknown as PayKitContext;
}

describe("product/product-sync.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getLatestProductSnapshot.mockResolvedValue(null);
    service.getProviderProduct.mockResolvedValue(null);
    service.insertProductVersion.mockImplementation(async (_database, input) =>
      createProduct({
        group: input.group,
        hash: input.hash,
        id: input.id,
        isDefault: input.isDefault,
        name: input.name,
        priceAmount: input.priceAmount,
        priceInterval: input.priceInterval,
        version: input.version,
      }),
    );
    service.listLatestActiveProducts.mockResolvedValue([]);
    service.archiveProductsByIds.mockResolvedValue([]);
    service.restoreProduct.mockImplementation(async (_database, internalId) =>
      createProduct({ internalId }),
    );
  });

  /** @see https://github.com/getpaykit/paykit/issues/123 */
  it("reports active database products missing from config as archived", async () => {
    const free = createPlan({
      hash: "hash_free",
      id: "free",
      isDefault: true,
      name: "Free",
      priceAmount: null,
      priceInterval: null,
    });
    service.getLatestProductSnapshot.mockResolvedValue({
      features: [] satisfies readonly StoredProductFeature[],
      product: createProduct({
        hash: "hash_free",
        id: "free",
        isDefault: true,
        name: "Free",
        priceAmount: null,
        priceInterval: null,
      }),
    });
    service.listLatestActiveProducts.mockResolvedValue([createProduct()]);

    const results = await dryRunSyncProducts(createContext([free]));

    expect(results).toEqual([
      expect.objectContaining({ action: "unchanged", id: "free" }),
      expect.objectContaining({ action: "archived", id: "pro", priceAmount: 2_000 }),
    ]);
  });

  /** @see https://github.com/getpaykit/paykit/issues/123 */
  it("archives removed paid products locally and in the provider", async () => {
    const storedProduct = createProduct({
      provider: { stripe: { priceId: "price_123", productId: "prod_123" } },
    });
    const ctx = createContext([]);
    service.listLatestActiveProducts.mockResolvedValue([storedProduct]);
    service.archiveProductsByIds.mockResolvedValue([storedProduct]);

    const results = await syncProducts(ctx);

    expect(service.archiveProductsByIds).toHaveBeenCalledWith(ctx.database, ["pro"]);
    expect(ctx.provider.archiveProduct).toHaveBeenCalledWith({ providerProductId: "prod_123" });
    expect(results).toEqual([
      expect.objectContaining({ action: "archived", id: "pro", version: 1 }),
    ]);
  });

  /** @see https://github.com/getpaykit/paykit/issues/123 */
  it("restores a reintroduced archived product when the definition is unchanged", async () => {
    const plan = createPlan();
    const archivedProduct = createProduct({ archivedAt: new Date("2024-02-01T00:00:00.000Z") });
    const restoredProduct = createProduct();
    const ctx = createContext([plan]);
    service.getLatestProductSnapshot.mockResolvedValue({
      features: [] satisfies readonly StoredProductFeature[],
      product: archivedProduct,
    });
    service.getProviderProduct.mockResolvedValue({ priceId: "price_123", productId: "prod_123" });
    service.restoreProduct.mockResolvedValue(restoredProduct);

    const results = await syncProducts(ctx);

    expect(service.restoreProduct).toHaveBeenCalledWith(ctx.database, archivedProduct.internalId);
    expect(ctx.provider.syncProduct).toHaveBeenCalledWith({
      existingProviderPriceId: "price_123",
      existingProviderProductId: "prod_123",
      id: "pro",
      name: "Pro",
      priceAmount: 2_000,
      priceInterval: "month",
    });
    expect(results).toEqual([expect.objectContaining({ action: "updated", id: "pro" })]);
  });

  /** @see https://github.com/getpaykit/paykit/issues/123 */
  it("creates a new version when a reintroduced archived product definition changed", async () => {
    const plan = createPlan({ hash: "hash_pro_v2", priceAmount: 3_000 });
    const archivedProduct = createProduct({ archivedAt: new Date("2024-02-01T00:00:00.000Z") });
    const nextProduct = createProduct({
      hash: "hash_pro_v2",
      priceAmount: 3_000,
      version: 2,
    });
    const ctx = createContext([plan]);
    service.getLatestProductSnapshot.mockResolvedValue({
      features: [] satisfies readonly StoredProductFeature[],
      product: archivedProduct,
    });
    service.getProviderProduct.mockResolvedValue({ priceId: "price_123", productId: "prod_123" });
    service.insertProductVersion.mockResolvedValue(nextProduct);

    const results = await syncProducts(ctx);

    expect(service.insertProductVersion).toHaveBeenCalledWith(
      ctx.database,
      expect.objectContaining({ id: "pro", priceAmount: 3_000, version: 2 }),
    );
    expect(ctx.provider.syncProduct).toHaveBeenCalledWith({
      existingProviderPriceId: null,
      existingProviderProductId: "prod_123",
      id: "pro",
      name: "Pro",
      priceAmount: 3_000,
      priceInterval: "month",
    });
    expect(results).toEqual([expect.objectContaining({ action: "created", version: 2 })]);
  });
});
