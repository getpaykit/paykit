import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { generateId } from "../core/utils";
import {
  findCustomerByProviderCustomerId,
  upsertProviderCustomer,
} from "../customer/customer.service";
import type { PayKitDatabase } from "../database";
import { entitlement, product, subscription } from "../database/schema";
import { upsertInvoiceRecord } from "../invoice/invoice.service";
import { getDefaultPaymentMethod } from "../payment-method/payment-method.service";
import {
  getDefaultProductInGroup,
  getLatestProduct,
  getProductByProviderPriceId,
  withProviderInfo,
} from "../product/product.service";
import type { ProviderRequiredAction, ProviderSubscription } from "../providers/provider";
import type {
  DeleteSubscriptionAction,
  NormalizedSubscription,
  NormalizedWebhookEvent,
  UpsertSubscriptionAction,
} from "../types/events";
import { addInterval } from "../types/interval";
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

export async function loadSubscribeContext(ctx: PayKitContext, input: SubscribeInput) {
  const providerId = ctx.provider.id;
  const normalizedPlan = ctx.plans.planMap.get(input.planId);
  const latestProduct = await getLatestProduct(ctx.database, input.planId);
  const storedPlan = latestProduct ? withProviderInfo(latestProduct, providerId) : null;

  if (!normalizedPlan || !storedPlan) {
    throw PayKitError.from(
      "NOT_FOUND",
      PAYKIT_ERROR_CODES.PLAN_NOT_FOUND,
      `Plan "${input.planId}" not found`,
    );
  }

  if (storedPlan.hash !== normalizedPlan.hash) {
    ctx.logger.error(
      { planId: input.planId },
      `Plan "${input.planId}" is out of sync. Run \`paykitjs push\` to update.`,
    );
    throw PayKitError.from(
      "INTERNAL_SERVER_ERROR",
      PAYKIT_ERROR_CODES.PLAN_NOT_SYNCED,
      `Plan "${input.planId}" schema has changed since last sync. Run \`paykitjs push\` to update.`,
    );
  }

  const isFreeTarget = storedPlan.priceAmount === null;
  const isPaidTarget = !isFreeTarget;
  if (isPaidTarget && !storedPlan.providerPriceId) {
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
  const isUpgrade =
    activeSubscription != null &&
    hasProviderSubscription(activeSubscription) &&
    targetAmount > activeAmount;

  return {
    activeSubscription,
    cancelUrl: input.cancelUrl,
    customerId: input.customerId,
    isFreeTarget,
    isPaidTarget,
    isUpgrade,
    normalizedPlan,
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

  if (!completion.subCtx.isUpgrade) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout completion is only valid for new paid subscriptions or upgrades to "${completion.subCtx.storedPlan.id}"`,
    );
  }

  await ctx.stripe.cancelSubscription({
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

export async function prepareSubscribeCheckoutCompleted(
  ctx: PayKitContext,
  event: NormalizedWebhookEvent<"checkout.completed">,
): Promise<SubscribeCheckoutCompletion | null> {
  if (event.payload.mode !== "subscription") {
    return null;
  }

  const intent = event.payload.metadata?.paykit_intent;
  if (intent !== "subscribe") {
    return null;
  }

  const customerId = event.payload.metadata?.paykit_customer_id;
  const planId = event.payload.metadata?.paykit_plan_id;
  if (!customerId || !planId) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      "Subscribe checkout metadata is missing paykit_customer_id or paykit_plan_id",
    );
  }

  const checkoutSubscription = event.payload.subscription ?? null;
  if (!checkoutSubscription) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      "Subscribe checkout completion is missing subscription data",
    );
  }

  const subCtx = await loadSubscribeContext(ctx, {
    customerId,
    planId,
    successUrl: "https://paykit.invalid/checkout",
  });
  if (subCtx.storedPlan.providerPriceId !== checkoutSubscription.providerPriceId) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Checkout price mismatch for plan "${planId}"`,
    );
  }

  const completion = {
    customerId,
    invoice: event.payload.invoice ?? null,
    subCtx,
    subscription: checkoutSubscription,
  };

  await cancelExistingProviderSubscriptionForCheckout(ctx, completion);

  return completion;
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

  const normalizedPlan = ctx.plans.planMap.get(defaultPlan.id);
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
    providerId?: string | null;
    providerData?: Record<string, unknown> | null;
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
    providerData: input.providerData,
    providerId: input.providerId,
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
    const existingSub = await getSubscriptionByProviderSubscriptionId(ctx.database, {
      providerId: ctx.provider.id,
      providerSubscriptionId: action.data.providerSubscriptionId,
    });
    if (!existingSub) {
      return customerRow.id;
    }

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

    return customerRow.id;
  }

  const existingSub = await getSubscriptionByProviderSubscriptionId(ctx.database, {
    providerId: ctx.provider.id,
    providerSubscriptionId: action.data.subscription.providerSubscriptionId,
  });
  const storedProduct = action.data.subscription.providerPriceId
    ? await getProductByProviderPriceId(ctx.database, {
        providerId: ctx.provider.id,
        providerPriceId: action.data.subscription.providerPriceId,
      })
    : null;
  const normalizedPlan = storedProduct ? (ctx.plans.planMap.get(storedProduct.id) ?? null) : null;

  const providerData = {
    subscriptionId: action.data.subscription.providerSubscriptionId,
  };

  const targetSub =
    existingSub ??
    (storedProduct && normalizedPlan
      ? await insertSubscriptionRecord(ctx.database, {
          currentPeriodEndAt: action.data.subscription.currentPeriodEndAt ?? null,
          currentPeriodStartAt: action.data.subscription.currentPeriodStartAt ?? null,
          customerId: customerRow.id,
          planFeatures: normalizedPlan.includes,
          productInternalId: storedProduct.internalId,
          providerData,
          providerId: ctx.provider.id,
          startedAt: action.data.subscription.currentPeriodStartAt ?? new Date(),
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
    providerData,
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
        providerData,
        providerId: ctx.provider.id,
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
  if (subscription?.providerData == null) {
    return null;
  }

  return typeof (subscription.providerData as Record<string, unknown>).subscriptionId === "string"
    ? ((subscription.providerData as Record<string, unknown>).subscriptionId as string)
    : null;
}

function hasProviderSubscription(subscription: ActiveSubscription): boolean {
  return getProviderSubscriptionId(subscription) != null;
}

function getProviderSubscriptionRef(subscription: ActiveSubscription): {
  subscriptionId: string | null;
  subscriptionScheduleId: string | null;
} {
  if (subscription?.providerData == null) {
    return {
      subscriptionId: null,
      subscriptionScheduleId: null,
    };
  }

  const providerData = subscription.providerData as Record<string, unknown>;
  return {
    subscriptionId:
      typeof providerData.subscriptionId === "string" ? providerData.subscriptionId : null,
    subscriptionScheduleId:
      typeof providerData.subscriptionScheduleId === "string"
        ? providerData.subscriptionScheduleId
        : null,
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
  const stripeResult = await ctx.stripe.resumeSubscription({
    providerSubscriptionId: activeSubscriptionRef.subscriptionId!,
    providerSubscriptionScheduleId: activeSubscriptionRef.subscriptionScheduleId,
  });

  await ctx.database.transaction(async (tx) => {
    await deleteScheduledSubscriptionsInGroupIfNeeded(tx, subCtx);
    await syncSubscriptionFromProvider(tx, {
      subscriptionId: activeSubscription.id,
      providerSubscription: stripeResult.subscription ?? {
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
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
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

  const stripeResult = await ctx.stripe.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.SUBSCRIPTION_CREATE_FAILED,
      );
    }

    await upsertProviderBackedTargetSubscription(tx, subCtx, {
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
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

  const stripeResult = await ctx.stripe.createSubscription({
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
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
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
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

  const stripeResult = await ctx.stripe.cancelSubscription({
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
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
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

  const stripeResult = await ctx.stripe.scheduleSubscriptionChange({
    providerPriceId: subCtx.storedPlan.providerPriceId!,
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
    if (stripeResult.subscription) {
      await syncSubscriptionBillingState(tx, {
        currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
        currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
        providerData: {
          subscriptionId: stripeResult.subscription.providerSubscriptionId,
          subscriptionScheduleId: stripeResult.subscription.providerSubscriptionScheduleId ?? null,
        },
        status: stripeResult.subscription.status,
        subscriptionId: activeSubscription.id,
      });
    }
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
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

  if (subCtx.shouldUseCheckout) {
    return createCheckoutSubscribe(ctx, subCtx);
  }

  const stripeResult = await ctx.stripe.updateSubscription({
    providerPriceId: subCtx.storedPlan.providerPriceId!,
    providerSubscriptionId: activeSubscriptionRef.subscriptionId,
  });

  await ctx.database.transaction(async (tx) => {
    if (!stripeResult.subscription) {
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
      invoice: stripeResult.invoice ?? null,
      subscription: stripeResult.subscription,
    });
  });

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

/** Starts checkout and lets the webhook finalize the subscription later. */
async function createCheckoutSubscribe(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
): Promise<SubscribeResult> {
  const checkoutResult = await ctx.stripe.createSubscriptionCheckout({
    cancelUrl: subCtx.cancelUrl,
    metadata: {
      paykit_customer_id: subCtx.customerId,
      paykit_intent: "subscribe",
      paykit_plan_id: subCtx.storedPlan.id,
    },
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
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
    planFeatures: subCtx.normalizedPlan.includes,
    productInternalId: subCtx.storedPlan.internalId,
    providerId: subCtx.providerId,
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
  const providerData = {
    subscriptionId: input.subscription.providerSubscriptionId,
    subscriptionScheduleId: input.subscription.providerSubscriptionScheduleId ?? null,
  };

  let subscriptionId: string | null = null;
  if (options?.deferred) {
    const existingSub = await getSubscriptionByProviderSubscriptionId(database, {
      providerId: subCtx.providerId,
      providerSubscriptionId: input.subscription.providerSubscriptionId,
    });
    if (existingSub) {
      subscriptionId = existingSub.id;
      await syncSubscriptionBillingState(database, {
        currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
        currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
        providerData,
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
      planFeatures: subCtx.normalizedPlan.includes,
      productInternalId: subCtx.storedPlan.internalId,
      providerId: subCtx.providerId,
      providerData,
      startedAt: input.subscription.currentPeriodStartAt ?? new Date(),
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

type ProviderProductMap = Record<string, { productId: string; priceId: string | null }>;

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
  const providerMap = row.product.provider as ProviderProductMap | null;
  return {
    ...row.subscription,
    planGroup: row.product.group,
    planId: row.product.id,
    planIsDefault: row.product.isDefault,
    planName: row.product.name,
    priceAmount: row.product.priceAmount,
    priceInterval: row.product.priceInterval,
    providerPriceId: Object.values(providerMap ?? {})[0]?.priceId ?? null,
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
  input: { providerId: string; providerSubscriptionId: string },
): Promise<StoredSubscription | null> {
  return (
    (await database.query.subscription.findFirst({
      orderBy: (s, { desc: d }) => [d(s.createdAt)],
      where: and(
        eq(subscription.providerId, input.providerId),
        sql`${subscription.providerData}->>'subscriptionId' = ${input.providerSubscriptionId}`,
      ),
    })) ?? null
  );
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
    planFeatures: readonly NormalizedPlanFeature[];
    productInternalId: string;
    providerId?: string | null;
    providerData?: Record<string, unknown> | null;
    scheduledProductId?: string | null;
    startedAt?: Date | null;
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
      id: generateId("sub"),
      productInternalId: input.productInternalId,
      providerData: input.providerData ?? null,
      providerId: input.providerId ?? null,
      quantity: 1,
      scheduledProductId: input.scheduledProductId ?? null,
      startedAt: input.startedAt ?? now,
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
        nextResetAt: planFeature.resetInterval ? addInterval(now, planFeature.resetInterval) : null,
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
    providerId?: string | null;
    providerData?: Record<string, unknown> | null;
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
      providerData: input.providerData ?? null,
      providerId: input.providerId,
      startedAt: input.startedAt ?? new Date(),
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
    providerData?: Record<string, unknown> | null;
    startedAt?: Date | null;
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
      providerData: input.providerData !== undefined ? input.providerData : existing.providerData,
      startedAt: input.startedAt !== undefined ? input.startedAt : existing.startedAt,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, input.subscriptionId));
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
