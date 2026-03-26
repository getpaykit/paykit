import type { PayKitContext } from "../core/context";
import type { StoredProductFeature } from "../types/models";
import type { NormalizedPlan, NormalizedPlanFeature } from "../types/schema";
import {
  getLatestProductSnapshot,
  getProviderPrice,
  getProviderProduct,
  insertPrice,
  insertProductVersion,
  replaceProductFeatures,
  updateProductName,
  upsertFeature,
  upsertProviderPrice,
  upsertProviderProduct,
} from "./product-service";

export interface SyncProductResult {
  id: string;
  version: number;
  action: "created" | "updated" | "unchanged";
}

function serializeFeatureConfig(config: Record<string, unknown> | null): string {
  return JSON.stringify(config ?? null);
}

function featuresChanged(
  existing: readonly StoredProductFeature[],
  next: readonly NormalizedPlanFeature[],
): boolean {
  if (existing.length !== next.length) {
    return true;
  }

  return existing.some((storedFeature, index) => {
    const nextFeature = next[index];
    if (!nextFeature) {
      return true;
    }

    return (
      storedFeature.featureId !== nextFeature.id ||
      storedFeature.limit !== nextFeature.limit ||
      storedFeature.resetInterval !== nextFeature.resetInterval ||
      serializeFeatureConfig(storedFeature.config) !== serializeFeatureConfig(nextFeature.config)
    );
  });
}

function planChanged(
  existing: Awaited<ReturnType<typeof getLatestProductSnapshot>>,
  next: NormalizedPlan,
): boolean {
  if (!existing) {
    return true;
  }

  return (
    existing.product.group !== next.group ||
    existing.product.isDefault !== next.isDefault ||
    (existing.price?.amount ?? null) !== next.priceAmount ||
    (existing.price?.interval ?? null) !== next.priceInterval ||
    featuresChanged(existing.features, next.includes)
  );
}

export async function dryRunSyncProducts(ctx: PayKitContext): Promise<SyncProductResult[]> {
  const results: SyncProductResult[] = [];

  for (const plan of ctx.plans.plans) {
    const existing = await getLatestProductSnapshot(ctx.database, plan.id);
    let action: SyncProductResult["action"] = "unchanged";

    if (!existing) {
      action = "created";
    } else if (planChanged(existing, plan)) {
      action = "created";
    } else if (existing.product.name !== plan.name) {
      action = "updated";
    }

    results.push({
      action,
      id: plan.id,
      version: existing ? existing.product.version : 1,
    });
  }

  return results;
}

export async function syncProducts(ctx: PayKitContext): Promise<SyncProductResult[]> {
  const results: SyncProductResult[] = [];
  const providerId = ctx.provider.id;

  for (const schemaFeature of ctx.plans.features) {
    await upsertFeature(ctx.database, schemaFeature);
  }

  for (const plan of ctx.plans.plans) {
    const existing = await getLatestProductSnapshot(ctx.database, plan.id);
    const existingProviderProduct = existing
      ? await getProviderProduct(ctx.database, existing.product.internalId, providerId)
      : null;
    const existingProviderPrice =
      existing?.price && existingProviderProduct
        ? await getProviderPrice(ctx.database, existing.price.id, providerId)
        : null;

    let storedProduct = existing?.product ?? null;
    let storedPrice = existing?.price ?? null;
    let action: SyncProductResult["action"] = "unchanged";

    if (!existing) {
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        version: 1,
      });
      if (plan.priceAmount !== null && plan.priceInterval !== null) {
        storedPrice = await insertPrice(ctx.database, {
          amount: plan.priceAmount,
          interval: plan.priceInterval,
          productInternalId: storedProduct.internalId,
        });
      } else {
        storedPrice = null;
      }
      await replaceProductFeatures(ctx.database, {
        features: plan.includes,
        productInternalId: storedProduct.internalId,
      });
      action = "created";
    } else if (planChanged(existing, plan)) {
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        version: existing.product.version + 1,
      });
      if (plan.priceAmount !== null && plan.priceInterval !== null) {
        storedPrice = await insertPrice(ctx.database, {
          amount: plan.priceAmount,
          interval: plan.priceInterval,
          productInternalId: storedProduct.internalId,
        });
      } else {
        storedPrice = null;
      }
      await replaceProductFeatures(ctx.database, {
        features: plan.includes,
        productInternalId: storedProduct.internalId,
      });
      action = "created";
    } else if (existing.product.name !== plan.name) {
      await updateProductName(ctx.database, existing.product.internalId, plan.name);
      storedProduct = { ...existing.product, name: plan.name };
      action = "updated";
    }

    if (!storedProduct) {
      throw new Error(`Failed to sync plan "${plan.id}".`);
    }

    if (storedPrice) {
      const shouldReuseExistingPriceId =
        action !== "created" && existingProviderPrice?.providerPriceId !== undefined;
      const providerResult = await ctx.stripe.syncProduct({
        existingProviderPriceId: shouldReuseExistingPriceId
          ? (existingProviderPrice?.providerPriceId ?? null)
          : null,
        existingProviderProductId: existingProviderProduct?.providerProductId ?? null,
        id: plan.id,
        name: plan.name,
        priceAmount: storedPrice.amount,
        priceInterval: storedPrice.interval,
      });

      await upsertProviderProduct(ctx.database, {
        productInternalId: storedProduct.internalId,
        providerId,
        providerProductId: providerResult.providerProductId,
      });
      await upsertProviderPrice(ctx.database, {
        priceId: storedPrice.id,
        providerId,
        providerPriceId: providerResult.providerPriceId,
      });
    }

    results.push({
      action,
      id: plan.id,
      version: storedProduct.version,
    });
  }

  return results;
}
