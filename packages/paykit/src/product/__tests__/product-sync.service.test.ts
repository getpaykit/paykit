import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestProductSnapshot: vi.fn(),
  getProviderProduct: vi.fn(),
  insertProductVersion: vi.fn(),
  replaceProductFeatures: vi.fn(),
  updateProductName: vi.fn(),
  upsertFeature: vi.fn(),
  upsertProviderProduct: vi.fn(),
}));

vi.mock("../product.service", () => mocks);

import { dryRunSyncProducts, syncProducts } from "../product-sync.service";

function createContext() {
  const provider = {
    id: "stripe",
    syncProducts: vi.fn().mockResolvedValue({
      results: [{ id: "pro", providerProduct: { priceId: "price_eur", productId: "prod_123" } }],
    }),
  };

  return {
    database: {},
    products: {
      features: [],
      plans: [
        {
          group: "base",
          hash: "hash_eur",
          id: "pro",
          includes: [],
          isDefault: false,
          name: "Pro",
          priceAmount: 2900,
          priceCurrency: "eur",
          priceInterval: "month",
          trialDays: null,
        },
      ],
    },
    provider,
  };
}

const existingProduct = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  group: "base",
  hash: "hash_usd",
  id: "pro",
  internalId: "prod_old",
  isDefault: false,
  name: "Pro",
  priceAmount: 2900,
  priceCurrency: "usd",
  priceInterval: "month",
  stripePriceId: "price_usd",
  stripeProductId: "prod_123",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  version: 1,
};

describe("product-sync.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLatestProductSnapshot.mockResolvedValue({
      features: [],
      product: existingProduct,
    });
    mocks.getProviderProduct.mockResolvedValue({
      priceId: "price_usd",
      productId: "prod_123",
    });
    mocks.insertProductVersion.mockImplementation(async (_database, input) => ({
      ...existingProduct,
      ...input,
      internalId: "prod_new",
      stripePriceId: null,
      stripeProductId: null,
    }));
  });

  it("marks products as changed when currency changes", async () => {
    const ctx = createContext();

    await expect(dryRunSyncProducts(ctx as never)).resolves.toEqual([
      { action: "created", id: "pro", version: 1 },
    ]);
  });

  it("creates a new product version and syncs provider products with the new currency", async () => {
    const ctx = createContext();

    await expect(syncProducts(ctx as never)).resolves.toEqual([
      { action: "created", id: "pro", version: 2 },
    ]);

    expect(mocks.insertProductVersion).toHaveBeenCalledWith(
      ctx.database,
      expect.objectContaining({
        priceCurrency: "eur",
        version: 2,
      }),
    );
    expect(ctx.provider.syncProducts).toHaveBeenCalledWith({
      products: [
        {
          existingProviderProduct: { productId: "prod_123" },
          id: "pro",
          name: "Pro",
          priceAmount: 2900,
          priceCurrency: "eur",
          priceInterval: "month",
        },
      ],
    });
    expect(mocks.upsertProviderProduct).toHaveBeenCalledWith(ctx.database, {
      productInternalId: "prod_new",
      providerId: "stripe",
      providerProduct: { priceId: "price_eur", productId: "prod_123" },
    });
  });
});
