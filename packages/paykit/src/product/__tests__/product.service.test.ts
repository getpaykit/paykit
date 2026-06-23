import { describe, expect, it, vi } from "vitest";

import type { PayKitDatabase } from "../../database";
import type { StoredProduct } from "../../types/models";
import type { NormalizedPlan } from "../../types/schema";
import { getProductByPlan } from "../product.service";

const now = new Date("2026-01-01T00:00:00Z");

function createStoredProduct(overrides: Partial<StoredProduct> = {}): StoredProduct {
  return {
    createdAt: now,
    group: "base",
    hash: "old_hash",
    id: "pro",
    internalId: "prod_123",
    isDefault: false,
    name: "Pro",
    priceAmount: 2900,
    priceCurrency: "usd",
    priceInterval: "month",
    stripePriceId: "price_123",
    stripeProductId: "prod_stripe_123",
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

function createPlan(overrides: Partial<NormalizedPlan> = {}): NormalizedPlan {
  return {
    group: "base",
    hash: "new_hash",
    id: "pro",
    includes: [],
    isDefault: false,
    name: "Pro",
    priceAmount: 2900,
    priceCurrency: "usd",
    priceInterval: "month",
    trialDays: null,
    ...overrides,
  };
}

function createDatabase(storedProduct: StoredProduct) {
  const productFindFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(storedProduct);
  const productFeatureFindMany = vi.fn().mockResolvedValue([]);

  return {
    database: {
      query: {
        product: {
          findFirst: productFindFirst,
        },
        productFeature: {
          findMany: productFeatureFindMany,
        },
      },
    } as unknown as PayKitDatabase,
    productFeatureFindMany,
    productFindFirst,
  };
}

describe("product.service", () => {
  it("falls back to a semantically matching product when only the hash changed", async () => {
    const storedProduct = createStoredProduct();
    const { database } = createDatabase(storedProduct);

    await expect(getProductByPlan(database, createPlan())).resolves.toEqual(storedProduct);
  });

  it("does not fall back when the stored product differs from the normalized plan", async () => {
    const { database } = createDatabase(createStoredProduct({ priceAmount: 3900 }));

    await expect(getProductByPlan(database, createPlan())).resolves.toBeNull();
  });
});
