import { and, desc, eq } from "drizzle-orm";

import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { feature, product, productFeature } from "../database/schema";
import type { StoredFeature, StoredProduct, StoredProductFeature } from "../types/models";
import type { NormalizedFeature, NormalizedPlanFeature } from "../types/schema";

export interface StoredProductSnapshot {
  features: readonly StoredProductFeature[];
  product: StoredProduct;
}

export interface StoredProductWithProvider extends StoredProduct {
  providerProduct: Record<string, string> | null;
}

export function withProviderInfo(
  storedProduct: StoredProduct,
  _providerId: string,
): StoredProductWithProvider {
  return {
    ...storedProduct,
    providerProduct: getStripeProductInfo(storedProduct),
  };
}

function getStripeProductInfo(
  storedProduct: Pick<StoredProduct, "stripePriceId" | "stripeProductId">,
) {
  if (!storedProduct.stripePriceId) {
    return null;
  }

  return {
    priceId: storedProduct.stripePriceId,
    ...(storedProduct.stripeProductId ? { productId: storedProduct.stripeProductId } : {}),
  };
}

export async function getFeatureById(
  database: PayKitDatabase,
  featureId: string,
): Promise<StoredFeature | null> {
  const result = await database.query.feature.findFirst({
    where: eq(feature.id, featureId),
  });

  return result ?? null;
}

export async function upsertFeature(
  database: PayKitDatabase,
  input: NormalizedFeature,
): Promise<StoredFeature> {
  const now = new Date();
  const rows = await database
    .insert(feature)
    .values({
      createdAt: now,
      id: input.id,
      type: input.type,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: feature.id,
      set: {
        type: input.type,
        updatedAt: now,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw PayKitError.from(
      "INTERNAL_SERVER_ERROR",
      PAYKIT_ERROR_CODES.FEATURE_UPSERT_FAILED,
      `Failed to upsert feature "${input.id}"`,
    );
  }

  return row;
}

export async function getLatestProduct(
  database: PayKitDatabase,
  id: string,
): Promise<StoredProduct | null> {
  const result = await database.query.product.findFirst({
    where: eq(product.id, id),
    orderBy: (p, { desc }) => [desc(p.version)],
  });

  return result ?? null;
}

export async function getProductByHash(
  database: PayKitDatabase,
  id: string,
  hash: string,
): Promise<StoredProduct | null> {
  const result = await database.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.hash, hash)),
    orderBy: (p, { desc }) => [desc(p.version)],
  });

  return result ?? null;
}

export async function getProductByInternalId(
  database: PayKitDatabase,
  internalId: string,
): Promise<StoredProduct | null> {
  const result = await database.query.product.findFirst({
    where: eq(product.internalId, internalId),
  });

  return result ?? null;
}

export async function getLatestProductSnapshot(
  database: PayKitDatabase,
  id: string,
): Promise<StoredProductSnapshot | null> {
  const storedProduct = await getLatestProduct(database, id);
  if (!storedProduct) {
    return null;
  }

  const storedFeatures = await getProductFeatures(database, storedProduct.internalId);

  return {
    features: storedFeatures,
    product: storedProduct,
  };
}

export async function insertProductVersion(
  database: PayKitDatabase,
  input: {
    group: string;
    hash: string;
    id: string;
    isDefault: boolean;
    name: string;
    priceAmount: number | null;
    priceCurrency: string | null;
    priceInterval: string | null;
    version: number;
  },
): Promise<StoredProduct> {
  const now = new Date();
  const internalId = generateId("prod");
  await database.insert(product).values({
    createdAt: now,
    group: input.group,
    hash: input.hash,
    id: input.id,
    internalId,
    isDefault: input.isDefault,
    name: input.name,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
    priceInterval: input.priceInterval,
    updatedAt: now,
    version: input.version,
  });

  return {
    createdAt: now,
    group: input.group,
    hash: input.hash,
    id: input.id,
    internalId,
    isDefault: input.isDefault,
    name: input.name,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
    priceInterval: input.priceInterval,
    stripePriceId: null,
    stripeProductId: null,
    updatedAt: now,
    version: input.version,
  };
}

export async function updateProductName(
  database: PayKitDatabase,
  internalId: string,
  name: string,
): Promise<void> {
  await database
    .update(product)
    .set({ name, updatedAt: new Date() })
    .where(eq(product.internalId, internalId));
}

export async function getProductFeatures(
  database: PayKitDatabase,
  productInternalId: string,
): Promise<readonly StoredProductFeature[]> {
  const result = await database.query.productFeature.findMany({
    where: eq(productFeature.productInternalId, productInternalId),
    orderBy: (pf) => [pf.featureId],
  });

  return result;
}

export async function replaceProductFeatures(
  database: PayKitDatabase,
  input: {
    features: readonly NormalizedPlanFeature[];
    productInternalId: string;
  },
): Promise<void> {
  await database
    .delete(productFeature)
    .where(eq(productFeature.productInternalId, input.productInternalId));

  if (input.features.length === 0) {
    return;
  }

  const now = new Date();
  for (const planFeature of input.features) {
    await database.insert(productFeature).values({
      config: planFeature.config,
      createdAt: now,
      featureId: planFeature.id,
      limit: planFeature.limit,
      productInternalId: input.productInternalId,
      resetInterval: planFeature.resetInterval,
      updatedAt: now,
    });
  }
}

export async function getProviderProduct(
  database: PayKitDatabase,
  productInternalId: string,
  _providerId: string,
): Promise<Record<string, string> | null> {
  const row = await database.query.product.findFirst({
    where: eq(product.internalId, productInternalId),
  });
  if (!row) return null;

  return getStripeProductInfo(row);
}

export async function upsertProviderProduct(
  database: PayKitDatabase,
  input: {
    productInternalId: string;
    providerId: string;
    providerProduct: Record<string, string>;
  },
): Promise<void> {
  await database
    .update(product)
    .set({
      stripeProductId: input.providerProduct.productId ?? null,
      stripePriceId: input.providerProduct.priceId ?? null,
    })
    .where(eq(product.internalId, input.productInternalId));
}

export async function getDefaultProductInGroup(
  database: PayKitDatabase,
  group: string,
): Promise<StoredProduct | null> {
  const row = await database.query.product.findFirst({
    where: and(eq(product.group, group), eq(product.isDefault, true)),
    orderBy: [desc(product.version)],
  });

  return row ?? null;
}

export async function getProductByProviderData(
  database: PayKitDatabase,
  input: { providerId: string; key: string; value: string },
): Promise<StoredProduct | null> {
  const row = await database.query.product.findFirst({
    where:
      input.key === "productId"
        ? eq(product.stripeProductId, input.value)
        : eq(product.stripePriceId, input.value),
  });

  return row ?? null;
}
