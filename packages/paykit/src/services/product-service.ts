import { eq, sql } from "drizzle-orm";

import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import {
  feature,
  price,
  product,
  productFeature,
  providerPrice,
  providerProduct,
} from "../database/schema";
import type {
  StoredFeature,
  StoredPrice,
  StoredProduct,
  StoredProductFeature,
  StoredProviderPrice,
  StoredProviderProduct,
} from "../types/models";
import type { NormalizedFeature, NormalizedPlanFeature } from "../types/schema";

export interface StoredProductSnapshot {
  features: readonly StoredProductFeature[];
  price: StoredPrice | null;
  product: StoredProduct;
}

export interface StoredProductWithPrice extends StoredProduct {
  priceAmount: number | null;
  priceId: string | null;
  priceInterval: string | null;
  providerPriceId: string | null;
}

export async function getFeatureById(
  database: PayKitDatabase,
  featureId: string,
): Promise<StoredFeature | null> {
  const result = (await database.execute(sql`
    select
      id,
      type,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paykit_feature
    where id = ${featureId}
    limit 1
  `)) as unknown as { rows: StoredFeature[] };

  return result.rows[0] ?? null;
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
    throw new Error(`Failed to upsert feature "${input.id}".`);
  }

  return row;
}

export async function getLatestProduct(
  database: PayKitDatabase,
  id: string,
): Promise<StoredProduct | null> {
  const result = (await database.execute(sql`
    select
      internal_id as "internalId",
      id,
      version,
      name,
      "group",
      is_default as "isDefault",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paykit_product
    where id = ${id}
    order by version desc
    limit 1
  `)) as unknown as { rows: StoredProduct[] };

  return result.rows[0] ?? null;
}

export async function getLatestProductSnapshot(
  database: PayKitDatabase,
  id: string,
): Promise<StoredProductSnapshot | null> {
  const storedProduct = await getLatestProduct(database, id);
  if (!storedProduct) {
    return null;
  }

  const storedPrice = await getPriceByProductInternalId(database, storedProduct.internalId);
  const storedFeatures = await getProductFeatures(database, storedProduct.internalId);

  return {
    features: storedFeatures,
    price: storedPrice,
    product: storedProduct,
  };
}

export async function insertProductVersion(
  database: PayKitDatabase,
  input: {
    group: string;
    id: string;
    isDefault: boolean;
    name: string;
    version: number;
  },
): Promise<StoredProduct> {
  const now = new Date();
  const internalId = generateId("prod");
  await database.insert(product).values({
    createdAt: now,
    group: input.group,
    id: input.id,
    internalId,
    isDefault: input.isDefault,
    name: input.name,
    updatedAt: now,
    version: input.version,
  });

  return {
    createdAt: now,
    group: input.group,
    id: input.id,
    internalId,
    isDefault: input.isDefault,
    name: input.name,
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

export async function getPriceByProductInternalId(
  database: PayKitDatabase,
  productInternalId: string,
): Promise<StoredPrice | null> {
  const result = (await database.execute(sql`
    select
      id,
      product_internal_id as "productInternalId",
      amount,
      interval,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paykit_price
    where product_internal_id = ${productInternalId}
    limit 1
  `)) as unknown as { rows: StoredPrice[] };

  return result.rows[0] ?? null;
}

export async function insertPrice(
  database: PayKitDatabase,
  input: {
    amount: number;
    interval: string;
    productInternalId: string;
  },
): Promise<StoredPrice> {
  const now = new Date();
  const priceId = generateId("price");
  await database.insert(price).values({
    amount: input.amount,
    createdAt: now,
    id: priceId,
    interval: input.interval,
    productInternalId: input.productInternalId,
    updatedAt: now,
  });

  return {
    amount: input.amount,
    createdAt: now,
    id: priceId,
    interval: input.interval,
    productInternalId: input.productInternalId,
    updatedAt: now,
  };
}

export async function getProductFeatures(
  database: PayKitDatabase,
  productInternalId: string,
): Promise<readonly StoredProductFeature[]> {
  const result = (await database.execute(sql`
    select
      product_internal_id as "productInternalId",
      feature_id as "featureId",
      "limit",
      reset_interval as "resetInterval",
      config,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paykit_product_feature
    where product_internal_id = ${productInternalId}
  `)) as unknown as { rows: StoredProductFeature[] };

  return result.rows.toSorted((left, right) => left.featureId.localeCompare(right.featureId));
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
  providerId: string,
): Promise<StoredProviderProduct | null> {
  const result = (await database.execute(sql`
    select
      product_internal_id as "productInternalId",
      provider_id as "providerId",
      provider_product_id as "providerProductId",
      created_at as "createdAt"
    from paykit_provider_product
    where product_internal_id = ${productInternalId}
      and provider_id = ${providerId}
    limit 1
  `)) as unknown as { rows: StoredProviderProduct[] };

  return result.rows[0] ?? null;
}

export async function getProviderProductByProductId(
  database: PayKitDatabase,
  productId: string,
  providerId: string,
): Promise<StoredProviderProduct | null> {
  const latestProduct = await getLatestProduct(database, productId);
  if (!latestProduct) {
    return null;
  }

  return getProviderProduct(database, latestProduct.internalId, providerId);
}

export async function upsertProviderProduct(
  database: PayKitDatabase,
  input: {
    productInternalId: string;
    providerId: string;
    providerProductId: string;
  },
): Promise<void> {
  await database
    .insert(providerProduct)
    .values({
      createdAt: new Date(),
      productInternalId: input.productInternalId,
      providerId: input.providerId,
      providerProductId: input.providerProductId,
    })
    .onConflictDoUpdate({
      target: [providerProduct.productInternalId, providerProduct.providerId],
      set: {
        providerProductId: input.providerProductId,
      },
    });
}

export async function getProviderPrice(
  database: PayKitDatabase,
  priceId: string,
  providerId: string,
): Promise<StoredProviderPrice | null> {
  const result = (await database.execute(sql`
    select
      price_id as "priceId",
      provider_id as "providerId",
      provider_price_id as "providerPriceId",
      created_at as "createdAt"
    from paykit_provider_price
    where price_id = ${priceId}
      and provider_id = ${providerId}
    limit 1
  `)) as unknown as { rows: StoredProviderPrice[] };

  return result.rows[0] ?? null;
}

export async function upsertProviderPrice(
  database: PayKitDatabase,
  input: {
    priceId: string;
    providerId: string;
    providerPriceId: string;
  },
): Promise<void> {
  await database
    .insert(providerPrice)
    .values({
      createdAt: new Date(),
      priceId: input.priceId,
      providerId: input.providerId,
      providerPriceId: input.providerPriceId,
    })
    .onConflictDoUpdate({
      target: [providerPrice.priceId, providerPrice.providerId],
      set: {
        providerPriceId: input.providerPriceId,
      },
    });
}

export async function getLatestProductWithPrice(
  database: PayKitDatabase,
  input: { id: string; providerId: string },
): Promise<StoredProductWithPrice | null> {
  const result = (await database.execute(sql`
    select
      product.internal_id as "internalId",
      product.id,
      product.version,
      product.name,
      product."group",
      product.is_default as "isDefault",
      product.created_at as "createdAt",
      product.updated_at as "updatedAt",
      price.id as "priceId",
      price.amount as "priceAmount",
      price.interval as "priceInterval",
      provider_price.provider_price_id as "providerPriceId"
    from paykit_product product
    left join paykit_price price on price.product_internal_id = product.internal_id
    left join paykit_provider_price provider_price
      on provider_price.price_id = price.id
      and provider_price.provider_id = ${input.providerId}
    where product.id = ${input.id}
    order by product.version desc
    limit 1
  `)) as unknown as { rows: StoredProductWithPrice[] };

  return result.rows[0] ?? null;
}

export async function getDefaultProductInGroup(
  database: PayKitDatabase,
  group: string,
  providerId: string,
): Promise<StoredProductWithPrice | null> {
  const result = (await database.execute(sql`
    select
      product.internal_id as "internalId",
      product.id,
      product.version,
      product.name,
      product."group",
      product.is_default as "isDefault",
      product.created_at as "createdAt",
      product.updated_at as "updatedAt",
      price.id as "priceId",
      price.amount as "priceAmount",
      price.interval as "priceInterval",
      provider_price.provider_price_id as "providerPriceId"
    from paykit_product product
    left join paykit_price price on price.product_internal_id = product.internal_id
    left join paykit_provider_price provider_price
      on provider_price.price_id = price.id
      and provider_price.provider_id = ${providerId}
    where product."group" = ${group}
      and product.is_default = true
    order by product.version desc
    limit 1
  `)) as unknown as { rows: StoredProductWithPrice[] };

  return result.rows[0] ?? null;
}

export async function getProductByProviderPriceId(
  database: PayKitDatabase,
  input: { providerId: string; providerPriceId: string },
): Promise<StoredProductWithPrice | null> {
  const result = (await database.execute(sql`
    select
      product.internal_id as "internalId",
      product.id,
      product.version,
      product.name,
      product."group",
      product.is_default as "isDefault",
      product.created_at as "createdAt",
      product.updated_at as "updatedAt",
      price.id as "priceId",
      price.amount as "priceAmount",
      price.interval as "priceInterval",
      provider_price.provider_price_id as "providerPriceId"
    from paykit_provider_price provider_price
    inner join paykit_price price on price.id = provider_price.price_id
    inner join paykit_product product on product.internal_id = price.product_internal_id
    where provider_price.provider_id = ${input.providerId}
      and provider_price.provider_price_id = ${input.providerPriceId}
    limit 1
  `)) as unknown as { rows: StoredProductWithPrice[] };

  return result.rows[0] ?? null;
}
