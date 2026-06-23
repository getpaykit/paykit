import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { StoredProductFeature } from "../types/models";
import type { NormalizedPlan, NormalizedPlanFeature } from "../types/schema";
import {
  getLatestProductSnapshot,
  getProviderProduct,
  insertProductVersion,
  replaceProductFeatures,
  updateProductName,
  upsertFeature,
  upsertProviderProduct,
} from "./product.service";

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
    (existing.product.priceAmount ?? null) !== next.priceAmount ||
    (existing.product.priceCurrency ?? null) !== next.priceCurrency ||
    (existing.product.priceInterval ?? null) !== next.priceInterval ||
    featuresChanged(existing.features, next.includes)
  );
}

function priceChanged(
  existing: Awaited<ReturnType<typeof getLatestProductSnapshot>>,
  next: NormalizedPlan,
): boolean {
  if (!existing) {
    return true;
  }

  return (
    (existing.product.priceAmount ?? null) !== next.priceAmount ||
    (existing.product.priceCurrency ?? null) !== next.priceCurrency ||
    (existing.product.priceInterval ?? null) !== next.priceInterval
  );
}

function withoutExistingPrice(
  providerProduct: Record<string, string> | null,
): Record<string, string> | null {
  if (!providerProduct?.productId) {
    return null;
  }

  return { productId: providerProduct.productId };
}

export async function dryRunSyncProducts(ctx: PayKitContext): Promise<SyncProductResult[]> {
  const results: SyncProductResult[] = [];

  for (const plan of ctx.products.plans) {
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

  for (const schemaFeature of ctx.products.features) {
    await upsertFeature(ctx.database, schemaFeature);
  }

  const paidPlansToSync: Array<{
    id: string;
    name: string;
    priceAmount: number;
    priceCurrency: string;
    priceInterval: string;
    existingProviderProduct: Record<string, string> | null;
    storedProductInternalId: string;
  }> = [];

  for (const plan of ctx.products.plans) {
    const existing = await getLatestProductSnapshot(ctx.database, plan.id);
    const existingProviderProduct = existing
      ? await getProviderProduct(ctx.database, existing.product.internalId, providerId)
      : null;

    let storedProduct = existing?.product ?? null;
    let action: SyncProductResult["action"] = "unchanged";
    let providerProductForSync = existingProviderProduct;

    if (!existing) {
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        hash: plan.hash,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        priceAmount: plan.priceAmount,
        priceCurrency: plan.priceCurrency,
        priceInterval: plan.priceInterval,
        version: 1,
      });
      await replaceProductFeatures(ctx.database, {
        features: plan.includes,
        productInternalId: storedProduct.internalId,
      });
      action = "created";
    } else if (planChanged(existing, plan)) {
      if (priceChanged(existing, plan)) {
        providerProductForSync = withoutExistingPrice(existingProviderProduct);
      }
      storedProduct = await insertProductVersion(ctx.database, {
        group: plan.group,
        hash: plan.hash,
        id: plan.id,
        isDefault: plan.isDefault,
        name: plan.name,
        priceAmount: plan.priceAmount,
        priceCurrency: plan.priceCurrency,
        priceInterval: plan.priceInterval,
        version: existing.product.version + 1,
      });
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
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.PLAN_SYNC_FAILED,
        `Failed to sync plan "${plan.id}"`,
      );
    }

    if (
      storedProduct.priceAmount !== null &&
      storedProduct.priceCurrency !== null &&
      storedProduct.priceInterval !== null
    ) {
      paidPlansToSync.push({
        existingProviderProduct: providerProductForSync ?? null,
        id: plan.id,
        name: plan.name,
        priceAmount: storedProduct.priceAmount,
        priceCurrency: storedProduct.priceCurrency,
        priceInterval: storedProduct.priceInterval,
        storedProductInternalId: storedProduct.internalId,
      });
    }

    results.push({
      action,
      id: plan.id,
      version: storedProduct.version,
    });
  }

  if (paidPlansToSync.length > 0) {
    const providerResults = await ctx.provider.syncProducts({
      products: paidPlansToSync.map((p) => ({
        existingProviderProduct: p.existingProviderProduct,
        id: p.id,
        name: p.name,
        priceAmount: p.priceAmount,
        priceCurrency: p.priceCurrency,
        priceInterval: p.priceInterval,
      })),
    });

    const requestedIds = new Set(paidPlansToSync.map((p) => p.id));
    const resultById = new Map<string, (typeof providerResults.results)[number]>();
    for (const r of providerResults.results) {
      if (resultById.has(r.id)) {
        throw PayKitError.from(
          "INTERNAL_SERVER_ERROR",
          PAYKIT_ERROR_CODES.PLAN_SYNC_FAILED,
          `Provider syncProducts returned duplicate mapping for id: ${r.id}`,
        );
      }
      resultById.set(r.id, r);
    }
    const missingIds = [...requestedIds].filter((id) => !resultById.has(id));
    if (missingIds.length > 0 || resultById.size !== requestedIds.size) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.PLAN_SYNC_FAILED,
        `Provider syncProducts returned invalid mapping: missing=[${missingIds.join(", ")}], expected=${String(requestedIds.size)}, got=${String(resultById.size)}`,
      );
    }

    for (const [, providerResult] of resultById) {
      const plan = paidPlansToSync.find((p) => p.id === providerResult.id);
      if (!plan) continue;
      await upsertProviderProduct(ctx.database, {
        productInternalId: plan.storedProductInternalId,
        providerId,
        providerProduct: providerResult.providerProduct,
      });
    }
  }

  return results;
}
