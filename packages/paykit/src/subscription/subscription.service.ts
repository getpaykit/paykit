import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { generateId } from "../core/utils";
import {
  findCustomerByProviderCustomerId,
  upsertProviderCustomer,
} from "../customer/customer.service";
import type { PayKitDatabase } from "../database";
import { entitlement, feature, product, subscription } from "../database/schema";
import { upsertInvoiceRecord } from "../invoice/invoice.service";
import { getDefaultPaymentMethod } from "../payment-method/payment-method.service";
import {
  getDefaultProductInGroup,
  getProductByPlan,
  getProductByInternalId,
  getProductByProviderData,
  getProductFeatures,
  withProviderInfo,
} from "../product/product.service";
import type { ProviderRequiredAction, ProviderSubscription } from "../providers/provider";
import type {
  DeleteSubscriptionAction,
  NormalizedSubscription,
  NormalizedWebhookEvent,
  UpsertSubscriptionAction,
} from "../types/events";
import type { StoredSubscription } from "../types/models";
import type { NormalizedPlanFeature } from "../types/schema";
import type {
  SubscribeInput,
  SubscribeResult,
  SubscriptionWithCatalog,
} from "./subscription.types";

/** Applies the requested plan change for a customer and returns the immediate subscribe result. */
export async function subscribeToPlan(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  return ctx.logger.trace.run("sub", async () => {
    const startTime = Date.now();
    ctx.logger.info({ planId: input.planId, customerId: input.customerId }, "subscribe started");

    if (input.addOnPlanIds && input.addOnPlanIds.length > 0) {
      const result = await handleCombinedSubscribe(ctx, input);
      const duration = Date.now() - startTime;
      ctx.logger.info({ duration }, "subscribe completed");
      return result;
    }

    const subCtx = await loadSubscribeContext(ctx, input);

    let result: SubscribeResult;
    if (isSamePlan(subCtx)) {
      // Same plan means either a noop or resuming a pending cancellation.
      result = await handleSamePlanSubscribe(ctx, subCtx);
    } else if (!subCtx.activeSubscription) {
      // No current subscription means this is the customer's first plan in the group.
      result = await handleInitialSubscribe(ctx, subCtx);
    } else if (!hasProviderSubscription(subCtx.activeSubscription)) {
      // A local-only active subscription can be replaced immediately without provider updates.
      result = await handleLocalPlanSwitch(ctx, subCtx);
    } else if (subCtx.isFreeTarget) {
      // Switching from paid to free always happens at period end.
      result = await handleCancelToFree(ctx, subCtx);
    } else if (subCtx.isPaidCurrencyChange) {
      // Cross-currency paid changes need a new checkout-backed subscription.
      result = await createCheckoutSubscribe(ctx, subCtx);
    } else if (!subCtx.isUpgrade) {
      // Paid downgrades stay active now and schedule the cheaper plan for later.
      result = await handleScheduledDowngrade(ctx, subCtx);
    } else {
      // Paid upgrades take effect immediately or fall back to checkout.
      result = await handleUpgrade(ctx, subCtx);
    }

    const duration = Date.now() - startTime;
    ctx.logger.info({ duration }, "subscribe completed");
    return result;
  });
}

async function resolveStoredPlanFeatures(
  database: PayKitDatabase,
  productInternalId: string,
): Promise<readonly NormalizedPlanFeature[]> {
  const stored = await getProductFeatures(database, productInternalId);
  const featureIds = stored.map((f) => f.featureId);
  const features =
    featureIds.length > 0
      ? await database.query.feature.findMany({
          where: inArray(feature.id, featureIds),
        })
      : [];
  const featureTypeMap = new Map(features.map((f) => [f.id, f.type]));
  return stored.map((f) => ({
    config: f.config,
    id: f.featureId,
    limit: f.limit,
    resetInterval: f.resetInterval as NormalizedPlanFeature["resetInterval"],
    type: (featureTypeMap.get(f.featureId) ?? "metered") as NormalizedPlanFeature["type"],
  }));
}

export async function loadSubscribeContext(ctx: PayKitContext, input: SubscribeInput) {
  const providerId = ctx.provider.id;
  const normalizedPlan = ctx.products.planMap.get(input.planId);
  const matchingProduct = input.productInternalId
    ? await getProductByInternalId(ctx.database, input.productInternalId)
    : normalizedPlan
      ? await getProductByPlan(ctx.database, normalizedPlan)
      : null;
  const storedPlan = matchingProduct ? withProviderInfo(matchingProduct, providerId) : null;

  if (!storedPlan) {
    throw PayKitError.from(
      "NOT_FOUND",
      PAYKIT_ERROR_CODES.PLAN_NOT_FOUND,
      `Plan "${input.planId}" not found`,
    );
  }

  const isFreeTarget = storedPlan.priceAmount === null;
  const isPaidTarget = !isFreeTarget;
  if (isPaidTarget && !storedPlan.providerProduct) {
    throw PayKitError.from(
      "INTERNAL_SERVER_ERROR",
      PAYKIT_ERROR_CODES.PLAN_NOT_SYNCED,
      `Plan "${input.planId}" is not synced with provider`,
    );
  }

  await warnOnDuplicateActiveSubscriptionGroups(ctx, input.customerId);

  const { providerCustomerId } = await upsertProviderCustomer(ctx, {
    customerId: input.customerId,
  });
  const hasDefaultPaymentMethod =
    (await getDefaultPaymentMethod(ctx.database, {
      customerId: input.customerId,
      providerId,
    })) != null;

  const activeSubscription = storedPlan.group
    ? await getActiveSubscriptionInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
      })
    : null;
  const scheduledSubscriptions = storedPlan.group
    ? await getScheduledSubscriptionsInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
      })
    : [];

  const activeAmount = activeSubscription?.priceAmount ?? 0;
  const targetAmount = storedPlan.priceAmount ?? 0;
  const isPaidCurrencyChange =
    activeSubscription != null &&
    activeSubscription.priceCurrency !== null &&
    storedPlan.priceCurrency !== null &&
    activeSubscription.priceCurrency !== storedPlan.priceCurrency;
  const isUpgrade =
    activeSubscription != null &&
    hasProviderSubscription(activeSubscription) &&
    !isPaidCurrencyChange &&
    targetAmount > activeAmount;

  const planFeatures = normalizedPlan
    ? normalizedPlan.includes
    : await resolveStoredPlanFeatures(ctx.database, storedPlan.internalId);

  return {
    activeSubscription,
    cancelUrl: input.cancelUrl,
    customerId: input.customerId,
    isFreeTarget,
    isPaidTarget,
    isPaidCurrencyChange,
    isUpgrade,
    normalizedPlan,
    planFeatures,
    providerCustomerId,
    providerId,
    scheduledSubscriptions,
    shouldUseCheckout: isPaidTarget && (input.forceCheckout === true || !hasDefaultPaymentMethod),
    storedPlan,
    successUrl: input.successUrl,
  };
}

type SubscribeContext = Awaited<ReturnType<typeof loadSubscribeContext>>;
type ActiveSubscription = Awaited<ReturnType<typeof getActiveSubscriptionInGroup>>;

function buildSubscribeResult(input: {
  invoice?: {
    currency: string;
    hostedUrl?: string | null;
    periodEndAt?: Date | null;
    periodStartAt?: Date | null;
    providerInvoiceId: string;
    status: string | null;
    totalAmount: number;
  } | null;
  paymentUrl: string | null;
  requiredAction?: ProviderRequiredAction | null;
}): SubscribeResult {
  return {
    invoice: input.invoice
      ? {
          currency: input.invoice.currency,
          hostedUrl: input.invoice.hostedUrl ?? null,
          providerInvoiceId: input.invoice.providerInvoiceId,
          status: input.invoice.status,
          totalAmount: input.invoice.totalAmount,
        }
      : undefined,
    paymentUrl: input.paymentUrl,
    requiredAction: input.requiredAction ?? null,
  };
}

/** Starts one combined checkout for a base plan plus one or more add-on plans. */
async function handleCombinedSubscribe(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const allPlanIds = [input.planId, ...(input.addOnPlanIds ?? [])];
  if (new Set(allPlanIds).size !== allPlanIds.length) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.COMBINED_SUBSCRIBE_DUPLICATE_PLAN);
  }

  const subCtxs = await Promise.all(
    allPlanIds.map((planId) =>
      loadSubscribeContext(ctx, {
        customerId: input.customerId,
        cancelUrl: input.cancelUrl,
        forceCheckout: input.forceCheckout,
        planId,
        successUrl: input.successUrl,
      }),
    ),
  );

  const groups = subCtxs
    .map((subCtx) => subCtx.storedPlan.group)
    .filter((group) => group.length > 0);
  if (new Set(groups).size !== groups.length) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.COMBINED_SUBSCRIBE_DUPLICATE_GROUP);
  }
  if (subCtxs.some((subCtx) => subCtx.isFreeTarget)) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.COMBINED_SUBSCRIBE_REQUIRES_PAID_PLANS,
    );
  }
  if (subCtxs.some((subCtx) => subCtx.activeSubscription)) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.COMBINED_SUBSCRIBE_EXISTING_SUBSCRIPTION,
    );
  }

  const primary = subCtxs[0]!;
  const checkoutResult = await ctx.provider.createSubscriptionCheckout({
    cancelUrl: primary.cancelUrl,
    metadata: {
      paykit_customer_id: primary.customerId,
      paykit_intent: "subscribe",
      paykit_plan_ids: allPlanIds.join(","),
      paykit_product_internal_ids: subCtxs.map((subCtx) => subCtx.storedPlan.internalId).join(","),
    },
    providerCustomerId: primary.providerCustomerId,
    providerProducts: subCtxs.map((subCtx) => subCtx.storedPlan.providerProduct!),
    successUrl: primary.successUrl,
  });

  return buildSubscribeResult({ paymentUrl: checkoutResult.paymentUrl });
}

interface SubscribeCheckoutCompletion {
  customerId: string;
  invoice?: Parameters<typeof buildSubscribeResult>[0]["invoice"];
  subCtx: SubscribeContext;
  subscription: ProviderSubscription;
}

async function cancelExistingProviderSubscriptionForCheckout(
  ctx: PayKitContext,
  completion: SubscribeCheckoutCompletion,
): Promise<void> {
  const activeSubscriptionRef = getProviderSubscriptionRef(completion.subCtx.activeSubscription);

  if (isSamePlan(completion.subCtx)) {
    if (activeSubscriptionRef.subscriptionId === completion.subscription.providerSubscriptionId) {
      return;
    }

    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout completed for plan "${completion.subCtx.storedPlan.id}" after a different active subscription was already present`,
    );
  }

  if (!completion.subCtx.activeSubscription || !activeSubscriptionRef.subscriptionId) {
    return;
  }

  if (!completion.subCtx.isUpgrade && !completion.subCtx.isPaidCurrencyChange) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout completion is only valid for new paid subscriptions, upgrades, or cross-currency changes to "${completion.subCtx.storedPlan.id}"`,
    );
  }

  await ctx.provider.cancelSubscription({
    currentPeriodEndAt: completion.subCtx.activeSubscription.currentPeriodEndAt,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });
}

export async function applyCheckoutSubscription(
  ctx: PayKitContext,
  completion: SubscribeCheckoutCompletion,
): Promise<void> {
  const activeSubscriptionRef = getProviderSubscriptionRef(completion.subCtx.activeSubscription);

  if (isSamePlan(completion.subCtx)) {
    if (activeSubscriptionRef.subscriptionId === completion.subscription.providerSubscriptionId) {
      return;
    }

    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout completed for plan "${completion.subCtx.storedPlan.id}" after a different active subscription was already present`,
    );
  }

  if (completion.subCtx.activeSubscription && activeSubscriptionRef.subscriptionId) {
    await deleteScheduledSubscriptionsInGroupIfNeeded(ctx.database, completion.subCtx);
    await endSubscriptions(ctx.database, [completion.subCtx.activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
    await upsertProviderBackedTargetSubscription(ctx.database, completion.subCtx, completion, {
      deferred: true,
    });
    return;
  }

  if (completion.subCtx.activeSubscription) {
    await endSubscriptions(ctx.database, [completion.subCtx.activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
  }

  await upsertProviderBackedTargetSubscription(ctx.database, completion.subCtx, completion, {
    deferred: true,
  });
}

/** Resolves the Stripe subscription item matching a plan's price, for combined checkouts with multiple items. */
function matchCheckoutSubscriptionToPlan(
  checkoutSubscriptions: readonly ProviderSubscription[],
  storedProviderProduct: Record<string, string> | null,
): ProviderSubscription | undefined {
  if (checkoutSubscriptions.length === 1) {
    return checkoutSubscriptions[0];
  }

  return checkoutSubscriptions.find(
    (sub) =>
      storedProviderProduct != null &&
      (sub as NormalizedSubscription).providerProduct?.priceId === storedProviderProduct.priceId,
  );
}

export async function prepareSubscribeCheckoutCompleted(
  ctx: PayKitContext,
  event: NormalizedWebhookEvent<"checkout.completed">,
): Promise<SubscribeCheckoutCompletion[] | null> {
  if (event.payload.mode !== "subscription") {
    return null;
  }

  const intent = event.payload.metadata?.paykit_intent;
  if (intent !== "subscribe") {
    return null;
  }

  const customerId = event.payload.metadata?.paykit_customer_id;
  const planIdsMeta = event.payload.metadata?.paykit_plan_ids;
  const singlePlanId = event.payload.metadata?.paykit_plan_id;
  const planIds = planIdsMeta ? planIdsMeta.split(",") : singlePlanId ? [singlePlanId] : null;
  if (!customerId || !planIds || planIds.length === 0) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      "Subscribe checkout metadata is missing paykit_customer_id or paykit_plan_id",
    );
  }

  const productInternalIdsMeta = event.payload.metadata?.paykit_product_internal_ids;
  const singleProductInternalId = event.payload.metadata?.paykit_product_internal_id;
  const productInternalIds = productInternalIdsMeta
    ? productInternalIdsMeta.split(",")
    : singleProductInternalId
      ? [singleProductInternalId]
      : [];

  const checkoutSubscriptions: ProviderSubscription[] =
    event.payload.subscriptions ?? (event.payload.subscription ? [event.payload.subscription] : []);
  if (checkoutSubscriptions.length === 0) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      "Subscribe checkout completion is missing subscription data",
    );
  }

  const completions: SubscribeCheckoutCompletion[] = [];
  for (let i = 0; i < planIds.length; i++) {
    const planId = planIds[i]!;
    const productInternalId = productInternalIds[i];

    const subCtx = await loadSubscribeContext(ctx, {
      customerId,
      planId,
      productInternalId: productInternalId || undefined,
      successUrl: "https://paykit.invalid/checkout",
    });
    const storedProviderProduct = subCtx.storedPlan.providerProduct;
    const checkoutSubscription = matchCheckoutSubscriptionToPlan(
      checkoutSubscriptions,
      storedProviderProduct,
    );
    if (!checkoutSubscription) {
      throw PayKitError.from(
        "BAD_REQUEST",
        PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
        `Checkout completion did not include a matching subscription item for plan "${planId}"`,
      );
    }

    const checkoutProviderProduct = (checkoutSubscription as NormalizedSubscription)
      .providerProduct;
    if (checkoutProviderProduct && storedProviderProduct) {
      const checkoutKeys = Object.keys(checkoutProviderProduct);
      const storedKeys = Object.keys(storedProviderProduct);
      const mismatch =
        checkoutKeys.length !== storedKeys.length ||
        checkoutKeys.some((key) => checkoutProviderProduct[key] !== storedProviderProduct[key]);
      if (mismatch) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
          `Checkout product mismatch for plan "${planId}"`,
        );
      }
    }

    const completion: SubscribeCheckoutCompletion = {
      customerId,
      invoice: event.payload.invoice ?? null,
      subCtx,
      subscription: checkoutSubscription,
    };

    await cancelExistingProviderSubscriptionForCheckout(ctx, completion);
    completions.push(completion);
  }

  return completions;
}

export async function handleSubscribeCheckoutCompleted(
  ctx: PayKitContext,
  completion: SubscribeCheckoutCompletion,
): Promise<string> {
  await applyCheckoutSubscription(ctx, completion);

  return completion.customerId;
}

function isSamePlan(subCtx: SubscribeContext): boolean {
  return subCtx.activeSubscription?.planId === subCtx.storedPlan.id;
}

function getSubscriptionEffectiveDate(input: {
  currentPeriodEndAt?: Date | null;
  currentPeriodStartAt?: Date | null;
}): Date {
  return input.currentPeriodStartAt ?? input.currentPeriodEndAt ?? new Date();
}

async function ensureScheduledDefaultPlan(
  ctx: PayKitContext,
  input: {
    customerId: string;
    group: string;
    startsAt: Date;
  },
): Promise<void> {
  const existingScheduled = await getScheduledSubscriptionsInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.group,
  });
  if (existingScheduled.length > 0) {
    return;
  }

  const defaultPlan = await getDefaultProductInGroup(ctx.database, input.group);
  if (!defaultPlan || defaultPlan.priceAmount !== null) {
    return;
  }

  const normalizedPlan = ctx.products.planMap.get(defaultPlan.id);
  if (!normalizedPlan) {
    return;
  }

  await insertSubscriptionRecord(ctx.database, {
    customerId: input.customerId,
    planFeatures: normalizedPlan.includes,
    productInternalId: defaultPlan.internalId,
    startedAt: input.startsAt,
    status: "scheduled",
  });
}

async function activateScheduledSubscriptionForGroup(
  ctx: PayKitContext,
  input: {
    customerId: string;
    productGroup: string;
    productInternalId?: string | null;
    subscriptionStatus: string;
    subscriptionCurrentPeriodEndAt?: Date | null;
    subscriptionCurrentPeriodStartAt?: Date | null;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    stripeSubscriptionScheduleId?: string | null;
  },
): Promise<string | null> {
  const activationDate = getSubscriptionEffectiveDate({
    currentPeriodEndAt: input.subscriptionCurrentPeriodEndAt,
    currentPeriodStartAt: input.subscriptionCurrentPeriodStartAt,
  });
  const scheduledSubs = await getScheduledSubscriptionsInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.productGroup,
  });

  const targetSub = scheduledSubs.find((scheduled) => {
    if (scheduled.startedAt && scheduled.startedAt > activationDate) {
      return false;
    }

    if (!input.productInternalId) {
      return true;
    }

    return scheduled.productInternalId === input.productInternalId;
  });

  if (!targetSub) {
    return null;
  }

  const activeSub = await getActiveSubscriptionInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.productGroup,
  });

  if (activeSub && activeSub.id !== targetSub.id) {
    await endSubscriptions(ctx.database, [activeSub.id], {
      canceled: activeSub.canceled,
      endedAt: activationDate,
      status: "ended",
    });
  }

  await activateScheduledSubscription(ctx.database, {
    currentPeriodEndAt: input.subscriptionCurrentPeriodEndAt,
    currentPeriodStartAt: input.subscriptionCurrentPeriodStartAt,
    subscriptionId: targetSub.id,
    startedAt: targetSub.startedAt ?? activationDate,
    status: input.subscriptionStatus,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeSubscriptionItemId: input.stripeSubscriptionItemId,
    stripeSubscriptionScheduleId: input.stripeSubscriptionScheduleId,
  });

  return targetSub.id;
}

export async function applySubscriptionWebhookAction(
  ctx: PayKitContext,
  action: UpsertSubscriptionAction | DeleteSubscriptionAction,
): Promise<string | null> {
  const customerRow = await findCustomerByProviderCustomerId(ctx.database, {
    providerCustomerId: action.data.providerCustomerId,
    providerId: ctx.provider.id,
  });
  if (!customerRow) {
    return null;
  }

  if (action.type === "subscription.delete") {
    const existingSubs = await getSubscriptionsByProviderSubscriptionId(ctx.database, {
      providerSubscriptionId: action.data.providerSubscriptionId,
    });
    if (existingSubs.length === 0) {
      return customerRow.id;
    }

    for (const existingSub of existingSubs) {
      const effectiveEndDate = existingSub.currentPeriodEndAt ?? new Date();

      await endSubscriptions(ctx.database, [existingSub.id], {
        canceled: true,
        endedAt: effectiveEndDate,
        status: "canceled",
      });

      const existingStoredProduct = await ctx.database.query.product.findFirst({
        where: eq(product.internalId, existingSub.productInternalId),
      });
      const productGroup = existingStoredProduct?.group ?? "";

      if (productGroup) {
        const effectiveDate = existingSub.currentPeriodEndAt ?? new Date();

        await ensureScheduledDefaultPlan(ctx, {
          customerId: customerRow.id,
          group: productGroup,
          startsAt: effectiveDate,
        });

        await activateScheduledSubscriptionForGroup(ctx, {
          customerId: customerRow.id,
          productGroup,
          subscriptionCurrentPeriodEndAt: null,
          subscriptionCurrentPeriodStartAt: effectiveDate,
          subscriptionStatus: "active",
        });
      }
    }

    return customerRow.id;
  }

  const existingSub = await resolveExistingSubscriptionForItem(ctx.database, {
    providerId: ctx.provider.id,
    providerSubscriptionId: action.data.subscription.providerSubscriptionId,
    providerSubscriptionItemId: action.data.subscription.providerSubscriptionItemId,
  });
  const providerProduct = action.data.subscription.providerProduct;
  const storedProduct = providerProduct
    ? await (async () => {
        for (const [key, value] of Object.entries(providerProduct)) {
          const found = await getProductByProviderData(ctx.database, {
            providerId: ctx.provider.id,
            key,
            value,
          });
          if (found) return found;
        }
        return null;
      })()
    : null;
  const normalizedPlan = storedProduct
    ? (ctx.products.planMap.get(storedProduct.id) ?? null)
    : null;

  const targetSub =
    existingSub ??
    (storedProduct && normalizedPlan
      ? await insertSubscriptionRecord(ctx.database, {
          currentPeriodEndAt: action.data.subscription.currentPeriodEndAt ?? null,
          currentPeriodStartAt: action.data.subscription.currentPeriodStartAt ?? null,
          customerId: customerRow.id,
          planFeatures: normalizedPlan.includes,
          productInternalId: storedProduct.internalId,
          startedAt: action.data.subscription.currentPeriodStartAt ?? new Date(),
          stripeSubscriptionId: action.data.subscription.providerSubscriptionId,
          stripeSubscriptionItemId: action.data.subscription.providerSubscriptionItemId ?? null,
          stripeSubscriptionScheduleId:
            action.data.subscription.providerSubscriptionScheduleId ?? null,
          status: action.data.subscription.status,
        })
      : null);

  if (!targetSub) {
    return customerRow.id;
  }

  await syncSubscriptionFromProvider(ctx.database, {
    providerSubscription: action.data.subscription,
    subscriptionId: targetSub.id,
  });

  await syncSubscriptionBillingState(ctx.database, {
    stripeSubscriptionId: action.data.subscription.providerSubscriptionId,
    stripeSubscriptionItemId: action.data.subscription.providerSubscriptionItemId ?? null,
    stripeSubscriptionScheduleId: action.data.subscription.providerSubscriptionScheduleId ?? null,
    subscriptionId: targetSub.id,
  });

  const isGenuineResume =
    storedProduct &&
    existingSub?.cancelAtPeriodEnd &&
    !action.data.subscription.cancelAtPeriodEnd &&
    !action.data.subscription.providerSubscriptionScheduleId;

  if (isGenuineResume) {
    await deleteScheduledSubscriptionsInGroup(ctx.database, {
      customerId: customerRow.id,
      group: storedProduct.group,
    });

    const activeSub = await getActiveSubscriptionInGroup(ctx.database, {
      customerId: customerRow.id,
      group: storedProduct.group,
    });
    if (activeSub) {
      await replaceSubscriptionSchedule(ctx.database, {
        scheduledProductId: null,
        subscriptionId: activeSub.id,
      });
    }
  }

  if (storedProduct) {
    const activeSub = await getActiveSubscriptionInGroup(ctx.database, {
      customerId: customerRow.id,
      group: storedProduct.group,
    });
    const activeSubscriptions = await getActiveSubscriptionsInGroup(ctx.database, {
      customerId: customerRow.id,
      group: storedProduct.group,
    });
    const competingSubscriptions = activeSubscriptions.filter((sub) => sub.id !== targetSub.id);

    const subStatus = action.data.subscription.status;
    const isTerminal = subStatus === "canceled" || subStatus === "ended" || subStatus === "unpaid";

    if (action.data.subscription.cancelAtPeriodEnd && activeSub) {
      await scheduleSubscriptionCancellation(ctx.database, {
        canceledAt: action.data.subscription.canceledAt ?? new Date(),
        currentPeriodEndAt:
          action.data.subscription.currentPeriodEndAt ?? activeSub.currentPeriodEndAt,
        subscriptionId: activeSub.id,
      });

      await ensureScheduledDefaultPlan(ctx, {
        customerId: customerRow.id,
        group: storedProduct.group,
        startsAt:
          action.data.subscription.currentPeriodEndAt ?? activeSub.currentPeriodEndAt ?? new Date(),
      });
    }

    if (isTerminal && activeSub) {
      const effectiveDate = action.data.subscription.currentPeriodEndAt ?? new Date();

      await endSubscriptions(ctx.database, [activeSub.id], {
        canceled: true,
        endedAt: effectiveDate,
        status: "canceled",
      });

      await ensureScheduledDefaultPlan(ctx, {
        customerId: customerRow.id,
        group: storedProduct.group,
        startsAt: effectiveDate,
      });

      await activateScheduledSubscriptionForGroup(ctx, {
        customerId: customerRow.id,
        productGroup: storedProduct.group,
        subscriptionCurrentPeriodStartAt: effectiveDate,
        subscriptionStatus: "active",
      });
    } else {
      if (competingSubscriptions.length > 0) {
        const effectiveDate =
          action.data.subscription.currentPeriodStartAt ??
          action.data.subscription.currentPeriodEndAt ??
          new Date();

        await endSubscriptions(
          ctx.database,
          competingSubscriptions.map((sub) => sub.id),
          {
            canceled: false,
            endedAt: effectiveDate,
            status: "ended",
          },
        );
      }

      const activatedSubId = await activateScheduledSubscriptionForGroup(ctx, {
        customerId: customerRow.id,
        productGroup: storedProduct.group,
        productInternalId: storedProduct.internalId,
        stripeSubscriptionId: action.data.subscription.providerSubscriptionId,
        stripeSubscriptionItemId: action.data.subscription.providerSubscriptionItemId ?? null,
        stripeSubscriptionScheduleId:
          action.data.subscription.providerSubscriptionScheduleId ?? null,
        subscriptionCurrentPeriodEndAt: action.data.subscription.currentPeriodEndAt,
        subscriptionCurrentPeriodStartAt: action.data.subscription.currentPeriodStartAt,
        subscriptionStatus: action.data.subscription.status,
      });

      if (activatedSubId) {
        await syncSubscriptionFromProvider(ctx.database, {
          providerSubscription: action.data.subscription,
          subscriptionId: activatedSubId,
        });
      }
    }
  }

  return customerRow.id;
}

function getProviderSubscriptionId(subscription: ActiveSubscription): string | null {
  return subscription?.stripeSubscriptionId ?? null;
}

function hasProviderSubscription(subscription: ActiveSubscription): boolean {
  return getProviderSubscriptionId(subscription) != null;
}

function getProviderSubscriptionRef(subscription: ActiveSubscription): {
  subscriptionId: string | null;
  subscriptionItemId: string | null;
  subscriptionScheduleId: string | null;
} {
  return {
    subscriptionId: subscription?.stripeSubscriptionId ?? null,
    subscriptionItemId: subscription?.stripeSubscriptionItemId ?? null,
    subscriptionScheduleId: subscription?.stripeSubscriptionScheduleId ?? null,
  };
}

/** Returns a noop or resumes the current provider subscription. */
async function handleSamePlanSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  if (!activeSubscription) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const hasPendingChange = subCtx.scheduledSubscriptions.length > 0 || activeSubscription.canceled;
  if (!hasProviderSubscription(activeSubscription) || !hasPendingChange) {
    return buildSubscribeResult({ paymentUrl: null });
  }

  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  const providerResult = await ctx.provider.resumeSubscription({
    providerSubscriptionId: activeSubscriptionRef.subscriptionId!,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await syncSubscriptionFromProvider(tx, {
      subscriptionId: activeSubscription.id,
      providerSubscription: providerResult.subscription ?? {
        cancelAtPeriodEnd: false,
        providerSubscriptionId: activeSubscriptionRef.subscriptionId!,
        providerSubscriptionScheduleId: null,
        status: activeSubscription.status,
      },
    });
    await replaceSubscriptionSchedule(tx, {
      subscriptionId: activeSubscription.id,
      scheduledProductId: null,
    });
    if (providerResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: providerResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: providerResult.subscription.currentPeriodStartAt,
        stripeSubscriptionId: providerResult.subscription.providerSubscriptionId,
        stripeSubscriptionScheduleId:
          providerResult.subscription.providerSubscriptionScheduleId ?? null,
        status: providerResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Creates the first subscription in the product group. */
async function handleInitialSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  if (subCtx.isFreeTarget) {
    await ctx.database.transaction(async (tx) => {
      await insertLocalTargetSubscription(tx, subCtx, {
        startedAt: new Date(),
        status: "active",
      });
    });

    return buildSubscribeResult({ paymentUrl: null });
  }

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  const providerResult = await ctx.provider.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerProduct: subCtx.storedPlan.providerProduct!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!providerResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: providerResult.invoice ?? null,
      subscription: providerResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Replaces a local-only subscription with the requested target plan. */
async function handleLocalPlanSwitch(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  if (!activeSubscription) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  if (subCtx.isFreeTarget) {
    await ctx.database.transaction(async (tx) => {
      const now = new Date();
      await endSubscriptions(tx, [activeSubscription.id], {
        canceled: false,
        endedAt: now,
        status: "ended",
      });
      await insertLocalTargetSubscription(tx, subCtx, {
        startedAt: now,
        status: "active",
      });
    });

    return buildSubscribeResult({ paymentUrl: null });
  }

  const providerResult = await ctx.provider.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerProduct: subCtx.storedPlan.providerProduct!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!providerResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await endSubscriptions(tx, [activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: providerResult.invoice ?? null,
      subscription: providerResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Cancels the paid subscription and schedules the free plan for period end. */
async function handleCancelToFree(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const providerResult = await ctx.provider.cancelSubscription({
    currentPeriodEndAt: activeSubscription.currentPeriodEndAt,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await clearScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await insertLocalTargetSubscription(tx, subCtx, {
      startedAt: activeSubscription.currentPeriodEndAt ?? null,
      status: "scheduled",
    });
    await scheduleSubscriptionCancellation(tx, {
      canceledAt: new Date(),
      currentPeriodEndAt: activeSubscription.currentPeriodEndAt ?? null,
      subscriptionId: activeSubscription.id,
    });
    await replaceSubscriptionSchedule(tx, {
      scheduledProductId: subCtx.storedPlan.internalId,
      subscriptionId: activeSubscription.id,
    });
    if (providerResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: providerResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: providerResult.subscription.currentPeriodStartAt,
        stripeSubscriptionId: providerResult.subscription.providerSubscriptionId,
        stripeSubscriptionScheduleId:
          providerResult.subscription.providerSubscriptionScheduleId ?? null,
        status: providerResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Schedules a lower paid tier to start when the current billing period ends. */
async function handleScheduledDowngrade(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const providerResult = await ctx.provider.scheduleSubscriptionChange({
    providerProduct: subCtx.storedPlan.providerProduct!,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionItemId: activeSubscriptionRef.subscriptionItemId,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await clearScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await insertLocalTargetSubscription(tx, subCtx, {
      startedAt: activeSubscription.currentPeriodEndAt ?? null,
      status: "scheduled",
    });
    await scheduleSubscriptionCancellation(tx, {
      canceledAt: new Date(),
      currentPeriodEndAt: activeSubscription.currentPeriodEndAt ?? null,
      subscriptionId: activeSubscription.id,
    });
    await replaceSubscriptionSchedule(tx, {
      scheduledProductId: subCtx.storedPlan.internalId,
      subscriptionId: activeSubscription.id,
    });
    if (providerResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: providerResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: providerResult.subscription.currentPeriodStartAt,
        stripeSubscriptionId: providerResult.subscription.providerSubscriptionId,
        stripeSubscriptionScheduleId:
          providerResult.subscription.providerSubscriptionScheduleId ?? null,
        status: providerResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Upgrades the customer immediately or redirects them to checkout. */
async function handleUpgrade(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const activeSubscription = subCtx.activeSubscription;
  const activeSubscriptionRef = getProviderSubscriptionRef(activeSubscription);
  if (!activeSubscription || !activeSubscriptionRef.subscriptionId) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  const providerResult = await ctx.provider.updateSubscription({
    providerProduct: subCtx.storedPlan.providerProduct!,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
    providerSubscriptionItemId: activeSubscriptionRef.subscriptionItemId,
  });

  await ctx.database.transaction(async (tx) => {
    if (!providerResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await endSubscriptions(tx, [activeSubscription.id], {
      canceled: false,
      endedAt: new Date(),
      status: "ended",
    });
    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: providerResult.invoice ?? null,
      subscription: providerResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: providerResult.paymentUrl,
    requiredAction: providerResult.requiredAction,
  });
}

/** Starts checkout and lets the webhook finalize the subscription later. */
async function createCheckoutSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const checkoutResult = await ctx.provider.createSubscriptionCheckout({
    cancelUrl: subCtx.cancelUrl,
    metadata: {
      paykit_customer_id: subCtx.customerId,
      paykit_intent: "subscribe",
      paykit_plan_id: subCtx.storedPlan.id,
      paykit_product_internal_id: subCtx.storedPlan.internalId,
    },
    providerCustomerId: subCtx.providerCustomerId,
    providerProducts: [subCtx.storedPlan.providerProduct!],
    successUrl: subCtx.successUrl,
  });

  return buildSubscribeResult({ paymentUrl: checkoutResult.paymentUrl });
}

async function insertLocalTargetSubscription(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
  input: {
    startedAt: Date | null;
    status: "active" | "scheduled";
  },
): Promise<void> {
  await insertSubscriptionRecord(database, {
    customerId: subCtx.customerId,
    planFeatures: subCtx.planFeatures,
    productInternalId: subCtx.storedPlan.internalId,
    startedAt: input.startedAt,
    status: input.status,
  });
}

async function upsertProviderBackedTargetSubscription(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
  input: {
    invoice?: Parameters<typeof buildSubscribeResult>[0]["invoice"];
    subscription: ProviderSubscription;
  },
  options?: { deferred?: boolean },
): Promise<void> {
  let subscriptionId: string | null = null;
  if (options?.deferred) {
    const existingSub = await resolveExistingSubscriptionForItem(database, {
      providerId: subCtx.providerId,
      providerSubscriptionId: input.subscription.providerSubscriptionId,
      providerSubscriptionItemId: input.subscription.providerSubscriptionItemId,
    });
    if (existingSub) {
      subscriptionId = existingSub.id;
      await syncSubscriptionBillingState(database, {
        currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
        currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
        stripeSubscriptionId: input.subscription.providerSubscriptionId,
        stripeSubscriptionItemId: input.subscription.providerSubscriptionItemId ?? null,
        stripeSubscriptionScheduleId: input.subscription.providerSubscriptionScheduleId ?? null,
        status: input.subscription.status,
        subscriptionId: existingSub.id,
      });
    }
  }

  if (!subscriptionId) {
    const inserted = await insertSubscriptionRecord(database, {
      currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
      customerId: subCtx.customerId,
      planFeatures: subCtx.planFeatures,
      productInternalId: subCtx.storedPlan.internalId,
      startedAt: input.subscription.currentPeriodStartAt ?? new Date(),
      stripeSubscriptionId: input.subscription.providerSubscriptionId,
      stripeSubscriptionItemId: input.subscription.providerSubscriptionItemId ?? null,
      stripeSubscriptionScheduleId: input.subscription.providerSubscriptionScheduleId ?? null,
      status: input.subscription.status,
    });
    subscriptionId = inserted.id;
  }

  if (input.invoice) {
    await upsertInvoiceRecord(database, {
      customerId: subCtx.customerId,
      invoice: input.invoice,
      providerId: subCtx.providerId,
      subscriptionId,
    });
  }
}

/**
 * Resolves the Stripe subscription an add-on should attach to: the customer's
 * one active provider-backed subscription, or `targetSubscriptionId` when given
 * to disambiguate a customer with more than one. A supplied target id is
 * validated against the customer's active local rows before being returned.
 */
async function resolveAnchorProviderSubscription(
  database: PayKitDatabase,
  input: { customerId: string; targetSubscriptionId?: string },
): Promise<string> {
  const rows = await database
    .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
    .from(subscription)
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
        input.targetSubscriptionId ? eq(subscription.id, input.targetSubscriptionId) : undefined,
      ),
    );

  const distinctIds = new Set(
    rows.map((row) => row.stripeSubscriptionId).filter((id): id is string => id != null),
  );

  if (distinctIds.size === 0) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.ADDON_ANCHOR_NOT_FOUND);
  }
  if (distinctIds.size > 1) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.ADDON_ANCHOR_AMBIGUOUS);
  }
  return [...distinctIds][0]!;
}

/** Attaches a new add-on plan to the customer's existing subscription, charging their saved card immediately. */
export async function addSubscriptionAddOn(
  ctx: PayKitContext,
  input: { customerId: string; planId: string; targetSubscriptionId?: string },
): Promise<SubscribeResult> {
  const subCtx = await loadSubscribeContext(ctx, {
    customerId: input.customerId,
    planId: input.planId,
    successUrl: "https://paykit.invalid/addon",
  });

  if (subCtx.isFreeTarget) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.COMBINED_SUBSCRIBE_REQUIRES_PAID_PLANS,
    );
  }
  if (subCtx.activeSubscription) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.ADDON_ALREADY_ACTIVE);
  }

  const anchorSubscriptionId = await resolveAnchorProviderSubscription(ctx.database, {
    customerId: input.customerId,
    targetSubscriptionId: input.targetSubscriptionId,
  });

  const addSubscriptionItem = ctx.provider.addSubscriptionItem;
  if (!addSubscriptionItem) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_OPERATION_UNSUPPORTED);
  }

  // Serialize concurrent requests for the same customer/plan so only one can
  // attach the add-on, and tie the provider item creation to a pre-generated
  // local row id so a retried attempt cannot create duplicate provider items.
  const addOnSubscriptionId = generateId("addon");
  const providerResult = await ctx.database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`addon:${input.customerId}:${subCtx.storedPlan.internalId}`}))`,
    );

    const active = subCtx.storedPlan.group
      ? await getActiveSubscriptionInGroup(tx, {
          customerId: input.customerId,
          group: subCtx.storedPlan.group,
        })
      : null;
    if (active) {
      throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.ADDON_ALREADY_ACTIVE);
    }

    const result = await addSubscriptionItem({
      idempotencyKey: `paykit_addon:${addOnSubscriptionId}`,
      providerProduct: subCtx.storedPlan.providerProduct!,
      providerSubscriptionId: anchorSubscriptionId,
    });

    const inserted = await insertSubscriptionRecord(tx, {
      currentPeriodEndAt: result.subscription?.currentPeriodEndAt ?? null,
      currentPeriodStartAt: result.subscription?.currentPeriodStartAt ?? null,
      customerId: input.customerId,
      id: addOnSubscriptionId,
      planFeatures: subCtx.planFeatures,
      productInternalId: subCtx.storedPlan.internalId,
      startedAt: result.subscription?.currentPeriodStartAt ?? new Date(),
      stripeSubscriptionId: anchorSubscriptionId,
      stripeSubscriptionItemId: result.providerSubscriptionItemId,
      status: result.subscription?.status ?? "active",
    });

    if (result.invoice) {
      await upsertInvoiceRecord(tx, {
        customerId: input.customerId,
        invoice: result.invoice,
        providerId: subCtx.providerId,
        subscriptionId: inserted.id,
      });
    }

    return result;
  });

  return buildSubscribeResult({
    invoice: providerResult.invoice,
    paymentUrl: null,
    requiredAction: providerResult.requiredAction,
  });
}

/**
 * Removes an active add-on plan from the customer's subscription. The local row ends
 * synchronously so the caller's next read is correct without waiting on webhook latency;
 * `reconcileRemovedSubscriptionItems` is the eventual-consistency backstop for removals
 * made outside this call (e.g. directly in the Stripe Dashboard).
 */
export async function removeSubscriptionAddOn(
  ctx: PayKitContext,
  input: { customerId: string; planId: string },
): Promise<void> {
  const subCtx = await loadSubscribeContext(ctx, {
    customerId: input.customerId,
    planId: input.planId,
    successUrl: "https://paykit.invalid/addon",
  });

  const active = subCtx.activeSubscription;
  if (!active?.stripeSubscriptionId || !active.stripeSubscriptionItemId) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.ADDON_NOT_ACTIVE);
  }

  const removeSubscriptionItem = ctx.provider.removeSubscriptionItem;
  if (!removeSubscriptionItem) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_OPERATION_UNSUPPORTED);
  }

  await removeSubscriptionItem({
    providerSubscriptionId: active.stripeSubscriptionId,
    providerSubscriptionItemId: active.stripeSubscriptionItemId,
  });

  await endSubscriptions(ctx.database, [active.id], {
    canceled: false,
    endedAt: new Date(),
    status: "ended",
  });
}

async function clearScheduledSubscriptionsInGroupIfNeeded(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
): Promise<void> {
  if (!subCtx.storedPlan.group) {
    return;
  }

  await clearScheduledSubscriptionsInGroup(database, {
    customerId: subCtx.customerId,
    group: subCtx.storedPlan.group,
  });
}

async function deleteScheduledSubscriptionsInGroupIfNeeded(
  database: PayKitContext["database"],
  subCtx: SubscribeContext,
): Promise<void> {
  if (!subCtx.storedPlan.group) {
    return;
  }

  await deleteScheduledSubscriptionsInGroup(database, {
    customerId: subCtx.customerId,
    group: subCtx.storedPlan.group,
  });
}

function addResetInterval(date: Date, resetInterval: string): Date {
  const next = new Date(date);
  if (resetInterval === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (resetInterval === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (resetInterval === "month") {
    const day = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (next.getUTCDate() !== day) next.setUTCDate(0);
  }
  if (resetInterval === "year") {
    const day = next.getUTCDate();
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    if (next.getUTCDate() !== day) next.setUTCDate(0);
  }
  return next;
}

export async function warnOnDuplicateActiveSubscriptionGroups(
  ctx: PayKitContext,
  customerId: string,
): Promise<void> {
  const activeSubscriptions = await ctx.database
    .select({
      group: product.group,
      planId: product.id,
      subscriptionId: subscription.id,
    })
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, customerId),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    );

  const subscriptionsByGroup = new Map<string, Array<{ planId: string; subscriptionId: string }>>();

  for (const activeSubscription of activeSubscriptions) {
    const currentGroup = subscriptionsByGroup.get(activeSubscription.group) ?? [];
    currentGroup.push({
      planId: activeSubscription.planId,
      subscriptionId: activeSubscription.subscriptionId,
    });
    subscriptionsByGroup.set(activeSubscription.group, currentGroup);
  }

  for (const [group, subscriptionsInGroup] of subscriptionsByGroup) {
    if (subscriptionsInGroup.length < 2) {
      continue;
    }

    ctx.logger.warn(
      {
        customerId,
        group,
        subscriptions: subscriptionsInGroup,
      },
      "multiple active subscriptions detected in the same group",
    );
  }
}

function mapJoinRowToSubscriptionWithCatalog(row: {
  subscription: typeof subscription.$inferSelect;
  product: typeof product.$inferSelect;
}): SubscriptionWithCatalog {
  const stripeProduct = row.product.stripePriceId
    ? {
        priceId: row.product.stripePriceId,
        ...(row.product.stripeProductId ? { productId: row.product.stripeProductId } : {}),
      }
    : null;
  return {
    ...row.subscription,
    planGroup: row.product.group,
    planId: row.product.id,
    planIsDefault: row.product.isDefault,
    planName: row.product.name,
    priceAmount: row.product.priceAmount,
    priceCurrency: row.product.priceCurrency,
    priceInterval: row.product.priceInterval,
    providerProduct: stripeProduct,
  };
}

export async function getActiveSubscriptionInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string },
): Promise<SubscriptionWithCatalog | null> {
  const rows = await database
    .select()
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.group, input.group),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return mapJoinRowToSubscriptionWithCatalog(row);
}

export async function getActiveSubscriptionsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string },
): Promise<readonly SubscriptionWithCatalog[]> {
  const rows = await database
    .select()
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.group, input.group),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    )
    .orderBy(desc(subscription.createdAt));

  return rows.map(mapJoinRowToSubscriptionWithCatalog);
}

export async function getScheduledSubscriptionsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string },
): Promise<readonly SubscriptionWithCatalog[]> {
  const rows = await database
    .select()
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.group, input.group),
        eq(subscription.status, "scheduled"),
        isNull(subscription.endedAt),
      ),
    )
    .orderBy(desc(subscription.createdAt));

  return rows.map(mapJoinRowToSubscriptionWithCatalog);
}

export async function getSubscriptionByProviderSubscriptionId(
  database: PayKitDatabase,
  input: {
    providerId: string;
    providerSubscriptionId: string;
    providerSubscriptionItemId?: string | null;
  },
): Promise<StoredSubscription | null> {
  return (
    (await database.query.subscription.findFirst({
      orderBy: (s, { desc: d }) => [d(s.createdAt)],
      where: input.providerSubscriptionItemId
        ? and(
            eq(subscription.stripeSubscriptionId, input.providerSubscriptionId),
            eq(subscription.stripeSubscriptionItemId, input.providerSubscriptionItemId),
          )
        : eq(subscription.stripeSubscriptionId, input.providerSubscriptionId),
    })) ?? null
  );
}

/** All local rows sharing one Stripe subscription id, across every line item. */
export async function getSubscriptionsByProviderSubscriptionId(
  database: PayKitDatabase,
  input: { providerSubscriptionId: string },
): Promise<StoredSubscription[]> {
  return database.query.subscription.findMany({
    where: eq(subscription.stripeSubscriptionId, input.providerSubscriptionId),
  });
}

/**
 * Resolves the local row for one Stripe subscription item, self-healing legacy
 * rows created before item ids existed: if exactly one row for the Stripe
 * subscription has no item id yet, it's adopted rather than treated as missing
 * (which would otherwise insert a duplicate row for the same item).
 */
async function resolveExistingSubscriptionForItem(
  database: PayKitDatabase,
  input: {
    providerId: string;
    providerSubscriptionId: string;
    providerSubscriptionItemId?: string | null;
  },
): Promise<StoredSubscription | null> {
  const exact = await getSubscriptionByProviderSubscriptionId(database, input);
  if (exact || !input.providerSubscriptionItemId) {
    return exact;
  }

  const allForSubscription = await getSubscriptionsByProviderSubscriptionId(database, {
    providerSubscriptionId: input.providerSubscriptionId,
  });
  const legacyCandidates = allForSubscription.filter((sub) => sub.stripeSubscriptionItemId == null);
  return legacyCandidates.length === 1 ? legacyCandidates[0]! : null;
}

async function getSubscriptionById(
  database: PayKitDatabase,
  subscriptionId: string,
): Promise<StoredSubscription | null> {
  return (
    (await database.query.subscription.findFirst({
      where: eq(subscription.id, subscriptionId),
    })) ?? null
  );
}

export async function insertSubscriptionRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    id?: string;
    planFeatures: readonly NormalizedPlanFeature[];
    productInternalId: string;
    scheduledProductId?: string | null;
    startedAt?: Date | null;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    stripeSubscriptionScheduleId?: string | null;
    status: string;
    trialEndsAt?: Date | null;
  },
): Promise<StoredSubscription> {
  const now = new Date();
  const rows = await database
    .insert(subscription)
    .values({
      canceled: false,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      currentPeriodEndAt: input.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.currentPeriodStartAt ?? null,
      customerId: input.customerId,
      endedAt: null,
      id: input.id ?? generateId("sub"),
      productInternalId: input.productInternalId,
      quantity: 1,
      scheduledProductId: input.scheduledProductId ?? null,
      startedAt: input.startedAt ?? now,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
      stripeSubscriptionScheduleId: input.stripeSubscriptionScheduleId ?? null,
      status: input.status,
      trialEndsAt: input.trialEndsAt ?? null,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED);
  }

  if (input.planFeatures.length > 0) {
    for (const planFeature of input.planFeatures) {
      const isBoolean = planFeature.type === "boolean";
      await database.insert(entitlement).values({
        balance: isBoolean ? null : (planFeature.limit ?? 0),
        customerId: input.customerId,
        featureId: planFeature.id,
        id: generateId("ent"),
        limit: isBoolean ? null : (planFeature.limit ?? null),
        nextResetAt: planFeature.resetInterval
          ? addResetInterval(now, planFeature.resetInterval)
          : null,
        subscriptionId: row.id,
      });
    }
  }

  return row;
}

export async function endSubscriptions(
  database: PayKitDatabase,
  subscriptionIds: readonly string[],
  input: { canceled?: boolean; canceledAt?: Date | null; endedAt?: Date | null; status: string },
): Promise<void> {
  if (subscriptionIds.length === 0) {
    return;
  }

  await database
    .update(subscription)
    .set({
      canceled: input.canceled ?? false,
      canceledAt: input.canceledAt ?? (input.canceled ? new Date() : null),
      endedAt: input.endedAt ?? new Date(),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(inArray(subscription.id, [...subscriptionIds]));
}

export async function clearScheduledSubscriptionsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string },
): Promise<void> {
  const scheduled = await getScheduledSubscriptionsInGroup(database, input);
  if (scheduled.length === 0) {
    return;
  }

  await endSubscriptions(
    database,
    scheduled.map((item) => item.id),
    { endedAt: new Date(), status: "canceled" },
  );
}

async function deleteSubscriptions(
  database: PayKitDatabase,
  subscriptionIds: readonly string[],
): Promise<void> {
  if (subscriptionIds.length === 0) {
    return;
  }

  await database
    .delete(entitlement)
    .where(inArray(entitlement.subscriptionId, [...subscriptionIds]));

  await database.delete(subscription).where(inArray(subscription.id, [...subscriptionIds]));
}

export async function deleteScheduledSubscriptionsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string },
): Promise<void> {
  const scheduled = await getScheduledSubscriptionsInGroup(database, input);
  if (scheduled.length === 0) {
    return;
  }

  await deleteSubscriptions(
    database,
    scheduled.map((item) => item.id),
  );
}

export async function scheduleSubscriptionCancellation(
  database: PayKitDatabase,
  input: {
    canceledAt?: Date | null;
    currentPeriodEndAt?: Date | null;
    subscriptionId: string;
  },
): Promise<void> {
  const existing = await getSubscriptionById(database, input.subscriptionId);
  if (!existing) {
    return;
  }

  await database
    .update(subscription)
    .set({
      canceled: true,
      canceledAt: input.canceledAt ?? new Date(),
      endedAt: input.currentPeriodEndAt ?? existing.endedAt,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
}

export async function replaceSubscriptionSchedule(
  database: PayKitDatabase,
  input: { subscriptionId: string; scheduledProductId?: string | null },
): Promise<void> {
  await database
    .update(subscription)
    .set({
      scheduledProductId: input.scheduledProductId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
}

export async function activateScheduledSubscription(
  database: PayKitDatabase,
  input: {
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    subscriptionId: string;
    startedAt?: Date | null;
    status: string;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    stripeSubscriptionScheduleId?: string | null;
  },
): Promise<void> {
  await database
    .update(subscription)
    .set({
      canceled: false,
      canceledAt: null,
      currentPeriodEndAt: input.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.currentPeriodStartAt ?? null,
      endedAt: null,
      startedAt: input.startedAt ?? new Date(),
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
      stripeSubscriptionScheduleId: input.stripeSubscriptionScheduleId ?? null,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
}

export async function getScheduledSubscriptionsReadyForActivation(
  database: PayKitDatabase,
  input: {
    customerId: string;
    group: string;
    now: Date;
  },
): Promise<readonly SubscriptionWithCatalog[]> {
  const rows = await database
    .select()
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.group, input.group),
        eq(subscription.status, "scheduled"),
        isNull(subscription.endedAt),
        or(isNull(subscription.startedAt), lte(subscription.startedAt, input.now)),
      ),
    )
    .orderBy(desc(subscription.createdAt));

  return rows.map(mapJoinRowToSubscriptionWithCatalog);
}

export async function syncSubscriptionFromProvider(
  database: PayKitDatabase,
  input: {
    subscriptionId: string;
    providerSubscription: ProviderSubscription | NormalizedSubscription;
  },
): Promise<void> {
  const endedAt =
    input.providerSubscription.cancelAtPeriodEnd === false
      ? null
      : (input.providerSubscription.endedAt ?? null);
  const canceledAt =
    input.providerSubscription.cancelAtPeriodEnd === false
      ? null
      : (input.providerSubscription.canceledAt ?? null);

  await database
    .update(subscription)
    .set({
      canceled: input.providerSubscription.cancelAtPeriodEnd,
      cancelAtPeriodEnd: input.providerSubscription.cancelAtPeriodEnd,
      canceledAt,
      currentPeriodEndAt: input.providerSubscription.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.providerSubscription.currentPeriodStartAt ?? null,
      endedAt,
      status: input.providerSubscription.status,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
}

export async function syncSubscriptionBillingState(
  database: PayKitDatabase,
  input: {
    subscriptionId: string;
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    startedAt?: Date | null;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    stripeSubscriptionScheduleId?: string | null;
    status?: string;
  },
): Promise<void> {
  const existing = await database.query.subscription.findFirst({
    where: eq(subscription.id, input.subscriptionId),
  });
  if (!existing) {
    return;
  }

  await database
    .update(subscription)
    .set({
      currentPeriodEndAt:
        input.currentPeriodEndAt !== undefined
          ? input.currentPeriodEndAt
          : existing.currentPeriodEndAt,
      currentPeriodStartAt:
        input.currentPeriodStartAt !== undefined
          ? input.currentPeriodStartAt
          : existing.currentPeriodStartAt,
      startedAt: input.startedAt !== undefined ? input.startedAt : existing.startedAt,
      stripeSubscriptionId:
        input.stripeSubscriptionId !== undefined
          ? input.stripeSubscriptionId
          : existing.stripeSubscriptionId,
      stripeSubscriptionItemId:
        input.stripeSubscriptionItemId !== undefined
          ? input.stripeSubscriptionItemId
          : existing.stripeSubscriptionItemId,
      stripeSubscriptionScheduleId:
        input.stripeSubscriptionScheduleId !== undefined
          ? input.stripeSubscriptionScheduleId
          : existing.stripeSubscriptionScheduleId,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
}

/** Ends any local row for this Stripe subscription whose item no longer exists on it (e.g. a removed add-on). */
export async function reconcileRemovedSubscriptionItems(
  ctx: PayKitContext,
  input: { providerSubscriptionId: string; activeProviderSubscriptionItemIds: readonly string[] },
): Promise<void> {
  const rows = await getSubscriptionsByProviderSubscriptionId(ctx.database, {
    providerSubscriptionId: input.providerSubscriptionId,
  });
  const stale = rows.filter(
    (row) =>
      row.stripeSubscriptionItemId != null &&
      row.endedAt == null &&
      !input.activeProviderSubscriptionItemIds.includes(row.stripeSubscriptionItemId),
  );
  if (stale.length === 0) {
    return;
  }

  await endSubscriptions(
    ctx.database,
    stale.map((row) => row.id),
    { canceled: false, endedAt: new Date(), status: "ended" },
  );

  for (const row of stale) {
    const storedProduct = await ctx.database.query.product.findFirst({
      where: eq(product.internalId, row.productInternalId),
    });
    const productGroup = storedProduct?.group ?? "";
    if (!productGroup) {
      continue;
    }

    await ensureScheduledDefaultPlan(ctx, {
      customerId: row.customerId,
      group: productGroup,
      startsAt: new Date(),
    });
    await activateScheduledSubscriptionForGroup(ctx, {
      customerId: row.customerId,
      productGroup,
      subscriptionCurrentPeriodStartAt: new Date(),
      subscriptionStatus: "active",
    });
  }
}

export async function getCurrentSubscriptions(
  database: PayKitDatabase,
  customerId: string,
): Promise<
  readonly {
    currentPeriodEndAt: Date | null;
    endedAt: Date | null;
    id: string;
    startedAt: Date | null;
    status: string;
  }[]
> {
  return database
    .select({
      currentPeriodEndAt: subscription.currentPeriodEndAt,
      endedAt: subscription.endedAt,
      id: product.id,
      startedAt: subscription.startedAt,
      status: subscription.status,
    })
    .from(subscription)
    .innerJoin(product, eq(subscription.productInternalId, product.internalId))
    .where(
      and(
        eq(subscription.customerId, customerId),
        or(
          isNull(subscription.endedAt),
          sql`${subscription.endedAt} > now()`,
          eq(subscription.status, "scheduled"),
        ),
      ),
    )
    .orderBy(desc(subscription.createdAt));
}
