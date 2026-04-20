import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { StoredProductFeature } from "../types/models";
import type { NormalizedPlan, NormalizedPlanFeature } from "../types/schema";
import {
  archiveProductsByIds,
  getLatestProductSnapshot,
  getProviderProduct,
  insertProductVersion,
  listLatestActiveProducts,
  replaceProductFeatures,
  restoreProduct,
  updateProductName,
  upsertFeature,
  upsertProviderProduct,
} from "./product.service";

export interface SyncProductResult {
  action: "archived" | "created" | "updated" | "unchanged";
  id: string;
  name: string;
  priceAmount: number | null;
  priceInterval: string | null;
  version: number;
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
    (existing.product.priceAmount ?? null) !== next.priceAmount ||
    (existing.product.priceInterval ?? null) !== next.priceInterval ||
    featuresChanged(existing.features, next.includes)
  );
}

export async function dryRunSyncProducts(ctx: PayKitContext): Promise<SyncProductResult[]> {
  const results: SyncProductResult[] = [];
  const planIds = new Set(ctx.plans.plans.map((plan) => plan.id));

  for (const plan of ctx.plans.plans) {
    const existing = await getLatestProductSnapshot(ctx.database, plan.id, {
      includeArchived: true,
    });
    let action: SyncProductResult["action"] = "unchanged";

    if (!existing) {
      action = "created";
    } else if (planChanged(existing, plan)) {
      action = "created";
    } else if (existing.product.archivedAt) {
      action = "updated";
    } else if (existing.product.name !== plan.name) {
      action = "updated";
    }

    results.push({
      action,
      id: plan.id,
      name: plan.name,
      priceAmount: plan.priceAmount,
      priceInterval: plan.priceInterval,
      version: existing ? existing.product.version : 1,
    });
  }

  const activeProducts = await listLatestActiveProducts(ctx.database);
  for (const storedProduct of activeProducts) {
    if (planIds.has(storedProduct.id)) {
      continue;
    }

    results.push({
      action: "archived",
      id: storedProduct.id,
      name: storedProduct.name,
      priceAmount: storedProduct.priceAmount,
      priceInterval: storedProduct.priceInterval,
      version: storedProduct.version,
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
    const existing = await getLatestProductSnapshot(ctx.database, plan.id, {
      includeArchived: true,
    });
    const existingProviderProduct = existing
      ? await getProviderProduct(ctx.database, existing.product.internalId, providerId)
      : null;

    let storedProduct = existing?.product ?? null;
    let action: SyncProductResult["action"] = "unchanged";

    if (!existing) {
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        hash: plan.hash,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        priceAmount: plan.priceAmount,
        priceInterval: plan.priceInterval,
        version: 1,
      });
      await replaceProductFeatures(ctx.database, {
        features: plan.includes,
        productInternalId: storedProduct.internalId,
      });
      action = "created";
    } else if (planChanged(existing, plan)) {
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        hash: plan.hash,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        priceAmount: plan.priceAmount,
        priceInterval: plan.priceInterval,
        version: existing.product.version + 1,
      });
      await replaceProductFeatures(ctx.database, {
        features: plan.includes,
        productInternalId: storedProduct.internalId,
      });
      action = "created";
    } else if (existing.product.name !== plan.name || existing.product.archivedAt) {
      if (existing.product.name !== plan.name) {
        await updateProductName(ctx.database, existing.product.internalId, plan.name);
      }
      storedProduct = existing.product.archivedAt
        ? await restoreProduct(ctx.database, existing.product.internalId)
        : { ...existing.product, name: plan.name };
      action = "updated";
    }

    if (!storedProduct) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.PLAN_SYNC_FAILED,
        `Failed to sync plan "${plan.id}"`,
      );
    }

    if (storedProduct.priceAmount !== null && storedProduct.priceInterval !== null) {
      const shouldReuseExistingPriceId =
        action !== "created" && existingProviderProduct?.priceId !== undefined;
      const providerResult = await ctx.provider.syncProduct({
        existingProviderPriceId: shouldReuseExistingPriceId
          ? (existingProviderProduct?.priceId ?? null)
          : null,
        existingProviderProductId: existingProviderProduct?.productId ?? null,
        id: plan.id,
        name: plan.name,
        priceAmount: storedProduct.priceAmount,
        priceInterval: storedProduct.priceInterval,
      });

      await upsertProviderProduct(ctx.database, {
        productInternalId: storedProduct.internalId,
        providerId,
        providerProductId: providerResult.providerProductId,
        providerPriceId: providerResult.providerPriceId,
      });
    }

    results.push({
      action,
      id: plan.id,
      name: plan.name,
      priceAmount: storedProduct.priceAmount,
      priceInterval: storedProduct.priceInterval,
      version: storedProduct.version,
    });
  }

  const planIds = new Set(ctx.plans.plans.map((plan) => plan.id));
  const activeProducts = await listLatestActiveProducts(ctx.database);
  const productsToArchive = activeProducts.filter(
    (storedProduct) => !planIds.has(storedProduct.id),
  );
  const productIdsToArchive = productsToArchive.map((storedProduct) => storedProduct.id);
  const archivedProducts = await archiveProductsByIds(ctx.database, productIdsToArchive);
  const archivedProviderProductIds = new Set<string>();

  for (const storedProduct of archivedProducts) {
    const providerMap = (storedProduct.provider ?? {}) as Record<
      string,
      { priceId: string | null; productId: string }
    >;
    const providerProductId = providerMap[providerId]?.productId;
    if (providerProductId) {
      archivedProviderProductIds.add(providerProductId);
    }
  }

  for (const providerProductId of archivedProviderProductIds) {
    await ctx.provider.archiveProduct({ providerProductId });
  }

  for (const storedProduct of archivedProducts) {
    results.push({
      action: "archived",
      id: storedProduct.id,
      name: storedProduct.name,
      priceAmount: storedProduct.priceAmount,
      priceInterval: storedProduct.priceInterval,
      version: storedProduct.version,
    });
  }

  return results;
}
