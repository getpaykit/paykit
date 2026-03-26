import type { PayKitContext } from "../core/context";
import type { ProviderSubscription } from "../providers/provider";
import type {
  BillingPlan,
  PayKitBillingPlan,
  StripeCheckoutAction,
  StripeExecutionResult,
  StripeBillingPlan,
  StripeSubscriptionAction,
} from "../types/billing-plan";
import { serializeBillingPlan } from "../types/billing-plan";
import type { StoredSubscription } from "../types/models";
import type { NormalizedPlan } from "../types/schema";
import {
  buildSubscribeResult,
  clearScheduledCustomerProductsInGroup,
  createMetadata,
  deleteScheduledCustomerProductsInGroup,
  endCustomerProducts,
  getActiveCustomerProductInGroup,
  getScheduledCustomerProductsInGroup,
  getSubscriptionByCustomerProductId,
  getSubscriptionByProviderId,
  insertCustomerProductRecord,
  linkCustomerProductSubscription,
  linkMetadataToCheckoutSession,
  replaceCurrentProductSchedule,
  type RedirectMode,
  type SubscribeResult,
  type CustomerProductWithCatalog,
  scheduleCustomerProductCancellation,
  syncCustomerProductBillingState,
  syncCustomerProductFromSubscription,
  upsertInvoiceRecord,
  upsertSubscriptionRecord,
} from "./billing-service";
import { upsertProviderCustomer } from "./customer-service";
import { getDefaultPaymentMethod } from "./payment-method-service";
import type { StoredProductWithPrice } from "./product-service";
import { getDefaultProductInGroup, getLatestProductWithPrice } from "./product-service";

// ---------------------------------------------------------------------------
// Subscribe context — assembled in setup, passed through all stages
// ---------------------------------------------------------------------------

interface SubscribeInput {
  cancelUrl?: string;
  customerId: string;
  planId: string;
  prorationBehavior?: "always_invoice" | "none";
  redirectMode: RedirectMode;
  successUrl: string;
}

interface SubscribeContext {
  customerId: string;
  providerId: string;
  normalizedPlan: NormalizedPlan;
  storedPlan: StoredProductWithPrice;
  providerCustomerId: string;
  defaultPaymentMethod: unknown;
  activeProduct: CustomerProductWithCatalog | null;
  activeSubscription: StoredSubscription | null;
  scheduledProducts: readonly CustomerProductWithCatalog[];
  isFreeTarget: boolean;
  isPaidTarget: boolean;
  isUpgrade: boolean;
  shouldUseCheckout: boolean;
  trialDays: number | null;
  prorationBehavior: "always_invoice" | "none";
  successUrl: string;
  cancelUrl?: string;
  redirectMode: RedirectMode;
}

// ---------------------------------------------------------------------------
// Main entry point — 4-stage pipeline
// ---------------------------------------------------------------------------

export async function subscribeToPlan(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const subCtx = await setupSubscribeContext(ctx, input);
  const paykitPlan = computeBillingPlan(subCtx);
  const stripePlan = evaluateStripePlan(subCtx, paykitPlan);
  const billingPlan: BillingPlan = { paykit: paykitPlan, stripe: stripePlan };
  return executeBillingPlan(ctx, subCtx, billingPlan);
}

// ---------------------------------------------------------------------------
// Stage 1: Setup — gather all data needed for decision-making
// ---------------------------------------------------------------------------

async function setupSubscribeContext(
  ctx: PayKitContext,
  input: SubscribeInput,
): Promise<SubscribeContext> {
  const providerId = ctx.provider.id;
  const normalizedPlan = ctx.plans.plans.find((plan) => plan.id === input.planId);
  const storedPlan = await getLatestProductWithPrice(ctx.database, {
    id: input.planId,
    providerId,
  });

  if (!normalizedPlan || !storedPlan) {
    throw new Error(`Plan "${input.planId}" not found. Run: paykitjs sync-products`);
  }

  const isFreeTarget = storedPlan.priceId === null;
  const isPaidTarget = !isFreeTarget;

  if (isPaidTarget && !storedPlan.providerPriceId) {
    throw new Error(`Plan "${input.planId}" is not synced. Run: paykitjs sync-products`);
  }

  const providerCustomer = await upsertProviderCustomer(ctx, { customerId: input.customerId });
  const defaultPaymentMethod = await getDefaultPaymentMethod(ctx.database, {
    customerId: input.customerId,
    providerId,
  });

  const activeProduct = storedPlan.group
    ? await getActiveCustomerProductInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
        providerId,
      })
    : null;

  const scheduledProducts = storedPlan.group
    ? await getScheduledCustomerProductsInGroup(ctx.database, {
        customerId: input.customerId,
        group: storedPlan.group,
        providerId,
      })
    : [];

  const activeSubscription = activeProduct?.subscriptionId
    ? await getSubscriptionByCustomerProductId(ctx.database, activeProduct.id)
    : null;

  const activeAmount = activeProduct?.priceAmount ?? 0;
  const targetAmount = storedPlan.priceAmount ?? 0;
  const isUpgrade =
    activeProduct != null && activeSubscription != null && targetAmount > activeAmount;

  const shouldUseCheckout =
    isPaidTarget && input.redirectMode !== "never" && defaultPaymentMethod == null;

  return {
    activeProduct,
    activeSubscription,
    cancelUrl: input.cancelUrl,
    customerId: input.customerId,
    defaultPaymentMethod,
    isFreeTarget,
    isPaidTarget,
    isUpgrade,
    normalizedPlan,
    prorationBehavior: input.prorationBehavior ?? "always_invoice",
    providerCustomerId: providerCustomer.providerCustomerId,
    providerId,
    redirectMode: input.redirectMode,
    scheduledProducts,
    shouldUseCheckout,
    storedPlan,
    successUrl: input.successUrl,
    trialDays: normalizedPlan.trialDays,
  };
}

// ---------------------------------------------------------------------------
// Stage 2: Compute — pure function, no side effects
// ---------------------------------------------------------------------------

function computeBillingPlan(subCtx: SubscribeContext): PayKitBillingPlan {
  const { activeProduct, activeSubscription, scheduledProducts, storedPlan, normalizedPlan } =
    subCtx;
  const now = new Date();

  const basePlan: PayKitBillingPlan = {
    clearScheduledInGroup: false,
    customerId: subCtx.customerId,
    deleteScheduledInGroup: false,
    group: storedPlan.group,
    insertProducts: [],
    updateProduct: null,
  };

  // --- No active product: fresh subscription ---
  if (!activeProduct) {
    const status = subCtx.isFreeTarget
      ? "active"
      : subCtx.trialDays && subCtx.trialDays > 0
        ? "trialing"
        : "active";

    const trialEndsAt =
      subCtx.trialDays && subCtx.trialDays > 0
        ? new Date(now.getTime() + subCtx.trialDays * 24 * 60 * 60 * 1000)
        : null;

    return {
      ...basePlan,
      insertProducts: [
        {
          customerId: subCtx.customerId,
          planFeatures: normalizedPlan.includes,
          priceId: storedPlan.priceId,
          productInternalId: storedPlan.internalId,
          providerId: subCtx.providerId,
          startedAt: now,
          status,
          trialEndsAt,
        },
      ],
    };
  }

  // --- Same plan: resume or noop ---
  if (activeProduct.planId === storedPlan.id) {
    const hasPendingChange = scheduledProducts.length > 0 || activeProduct.canceled;

    if (!activeSubscription || !hasPendingChange) {
      return basePlan; // noop
    }

    // Resume: clear cancellation + delete scheduled products
    return {
      ...basePlan,
      deleteScheduledInGroup: true,
      updateProduct: {
        canceled: false,
        canceledAt: null,
        customerProductId: activeProduct.id,
        endedAt: null,
        scheduledProductId: null,
        status: activeProduct.status,
      },
    };
  }

  // --- No active subscription (free→paid or free→free transition) ---
  if (!activeSubscription) {
    const status = subCtx.isFreeTarget
      ? "active"
      : subCtx.trialDays && subCtx.trialDays > 0
        ? "trialing"
        : "active";

    const trialEndsAt =
      subCtx.trialDays && subCtx.trialDays > 0
        ? new Date(now.getTime() + subCtx.trialDays * 24 * 60 * 60 * 1000)
        : null;

    return {
      ...basePlan,
      insertProducts: [
        {
          customerId: subCtx.customerId,
          planFeatures: normalizedPlan.includes,
          priceId: storedPlan.priceId,
          productInternalId: storedPlan.internalId,
          providerId: subCtx.providerId,
          startedAt: now,
          status,
          trialEndsAt,
        },
      ],
      updateProduct: {
        canceled: false,
        canceledAt: null,
        customerProductId: activeProduct.id,
        endedAt: now,
        status: "ended",
      },
    };
  }

  // --- Downgrade or cancel-to-free (schedule at period end) ---
  if (subCtx.isFreeTarget || !subCtx.isUpgrade) {
    const currentPeriodEndAt =
      activeSubscription.currentPeriodEndAt ?? activeProduct.currentPeriodEndAt;

    return {
      ...basePlan,
      clearScheduledInGroup: true,
      insertProducts: [
        {
          customerId: subCtx.customerId,
          planFeatures: normalizedPlan.includes,
          priceId: storedPlan.priceId,
          productInternalId: storedPlan.internalId,
          providerId: subCtx.providerId,
          startedAt: currentPeriodEndAt ?? null,
          status: "scheduled",
        },
      ],
      updateProduct: {
        canceled: true,
        canceledAt: now,
        customerProductId: activeProduct.id,
        endedAt: currentPeriodEndAt ?? null,
        scheduledProductId: storedPlan.internalId,
        status: activeProduct.status,
      },
    };
  }

  // --- Upgrade (immediate) ---
  return {
    ...basePlan,
    deleteScheduledInGroup: true,
    insertProducts: [
      {
        customerId: subCtx.customerId,
        planFeatures: normalizedPlan.includes,
        priceId: storedPlan.priceId,
        productInternalId: storedPlan.internalId,
        providerId: subCtx.providerId,
        startedAt: now,
        status: "active",
      },
    ],
    updateProduct: {
      canceled: false,
      canceledAt: null,
      customerProductId: activeProduct.id,
      endedAt: now,
      status: "ended",
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Evaluate — translate PayKit plan to Stripe actions
// ---------------------------------------------------------------------------

function evaluateStripePlan(
  subCtx: SubscribeContext,
  paykitPlan: PayKitBillingPlan,
): StripeBillingPlan {
  const noAction: StripeBillingPlan = {
    checkoutAction: { type: "none" },
    invoiceAction: { type: "none" },
    subscriptionAction: { type: "none" },
  };

  // Free plan only — no Stripe calls
  if (subCtx.isFreeTarget && !subCtx.activeSubscription) {
    return noAction;
  }

  // Noop (same plan, no changes)
  if (paykitPlan.insertProducts.length === 0 && paykitPlan.updateProduct === null) {
    return noAction;
  }

  const { activeProduct, activeSubscription } = subCtx;

  // --- Resume ---
  if (activeProduct && activeProduct.planId === subCtx.storedPlan.id && paykitPlan.updateProduct) {
    return {
      ...noAction,
      subscriptionAction: {
        providerSubscriptionId: activeSubscription!.providerSubscriptionId,
        providerSubscriptionScheduleId: activeSubscription!.providerSubscriptionScheduleId,
        type: "resume",
      },
    };
  }

  // --- Cancel to free (with active subscription) ---
  if (subCtx.isFreeTarget && activeSubscription) {
    return {
      ...noAction,
      subscriptionAction: {
        currentPeriodEndAt:
          activeSubscription.currentPeriodEndAt ?? activeProduct?.currentPeriodEndAt,
        providerSubscriptionId: activeSubscription.providerSubscriptionId,
        providerSubscriptionScheduleId: activeSubscription.providerSubscriptionScheduleId,
        type: "cancel",
      },
    };
  }

  // --- Downgrade (schedule change at period end) ---
  if (activeSubscription && !subCtx.isUpgrade && !subCtx.isFreeTarget) {
    return {
      ...noAction,
      subscriptionAction: {
        providerPriceId: subCtx.storedPlan.providerPriceId!,
        providerSubscriptionId: activeSubscription.providerSubscriptionId,
        providerSubscriptionScheduleId: activeSubscription.providerSubscriptionScheduleId,
        type: "schedule_change",
      },
    };
  }

  // --- Upgrade with existing subscription ---
  if (activeSubscription && subCtx.isUpgrade) {
    if (subCtx.shouldUseCheckout) {
      // Checkout creates a new subscription — cancel the old one after checkout succeeds.
      return {
        ...noAction,
        checkoutAction: buildCheckoutAction(subCtx),
        subscriptionAction: {
          currentPeriodEndAt: activeSubscription.currentPeriodEndAt,
          providerSubscriptionId: activeSubscription.providerSubscriptionId,
          providerSubscriptionScheduleId: activeSubscription.providerSubscriptionScheduleId,
          type: "cancel",
        },
      };
    }
    return {
      ...noAction,
      subscriptionAction: {
        prorationBehavior: subCtx.prorationBehavior,
        providerPriceId: subCtx.storedPlan.providerPriceId!,
        providerSubscriptionId: activeSubscription.providerSubscriptionId,
        type: "update",
      },
    };
  }

  // --- New subscription (no active, or active was free with no sub) ---
  if (subCtx.shouldUseCheckout) {
    return {
      ...noAction,
      checkoutAction: buildCheckoutAction(subCtx),
    };
  }

  return {
    ...noAction,
    subscriptionAction: {
      providerCustomerId: subCtx.providerCustomerId,
      providerPriceId: subCtx.storedPlan.providerPriceId!,
      trialPeriodDays: subCtx.trialDays ?? undefined,
      type: "create",
    },
  };
}

function buildCheckoutAction(subCtx: SubscribeContext): StripeCheckoutAction {
  return {
    cancelUrl: subCtx.cancelUrl,
    metadata: {
      paykit_customer_id: subCtx.customerId,
      paykit_plan_id: subCtx.storedPlan.id,
    },
    providerCustomerId: subCtx.providerCustomerId,
    providerPriceId: subCtx.storedPlan.providerPriceId!,
    successUrl: subCtx.successUrl,
    trialPeriodDays: subCtx.trialDays ?? undefined,
    type: "create",
  };
}

// ---------------------------------------------------------------------------
// Stage 4: Execute — run Stripe calls, then DB mutations
// ---------------------------------------------------------------------------

async function executeBillingPlan(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
  billingPlan: BillingPlan,
): Promise<SubscribeResult> {
  const { stripe: stripePlan, paykit: paykitPlan } = billingPlan;

  // --- Checkout path: defer everything ---
  if (stripePlan.checkoutAction.type === "create") {
    return executeCheckoutPath(ctx, subCtx, billingPlan, stripePlan.checkoutAction);
  }

  // --- Direct path: execute Stripe then DB ---
  const stripeResult = await executeStripeAction(ctx, stripePlan.subscriptionAction);

  // Execute invoice action if needed
  if (stripePlan.invoiceAction.type === "create") {
    await ctx.stripe.createInvoice({
      autoAdvance: true,
      lines: stripePlan.invoiceAction.lines,
      providerCustomerId: stripePlan.invoiceAction.providerCustomerId,
    });
  }

  // Execute DB mutations
  await executePayKitPlan(ctx, subCtx.providerId, paykitPlan, stripeResult);

  return buildSubscribeResult({
    invoice: stripeResult.invoice,
    paymentUrl: stripeResult.paymentUrl,
    requiredAction: stripeResult.requiredAction,
  });
}

async function executeCheckoutPath(
  ctx: PayKitContext,
  subCtx: SubscribeContext,
  billingPlan: BillingPlan,
  checkoutAction: Extract<StripeCheckoutAction, { type: "create" }>,
): Promise<SubscribeResult> {
  const { id: metadataId } = await createMetadata(ctx.database, {
    data: {
      billingPlan: serializeBillingPlan(billingPlan),
      customerId: subCtx.customerId,
      planId: subCtx.storedPlan.id,
      type: "subscribe_deferred",
    },
    providerId: subCtx.providerId,
    type: "subscribe_deferred",
  });

  const checkoutResult = await ctx.stripe.createSubscriptionCheckout({
    cancelUrl: checkoutAction.cancelUrl,
    metadata: {
      ...checkoutAction.metadata,
      paykit_metadata_id: metadataId,
    },
    providerCustomerId: checkoutAction.providerCustomerId,
    providerPriceId: checkoutAction.providerPriceId,
    successUrl: checkoutAction.successUrl,
    trialPeriodDays: checkoutAction.trialPeriodDays,
  });

  await linkMetadataToCheckoutSession(ctx.database, {
    id: metadataId,
    providerCheckoutSessionId: checkoutResult.providerCheckoutSessionId,
  });

  return buildSubscribeResult({ paymentUrl: checkoutResult.paymentUrl });
}

export async function executeStripeAction(
  ctx: PayKitContext,
  action: StripeSubscriptionAction,
): Promise<StripeExecutionResult> {
  if (action.type === "none") {
    return { paymentUrl: null };
  }

  if (action.type === "create") {
    return ctx.stripe.createSubscription({
      providerCustomerId: action.providerCustomerId,
      providerPriceId: action.providerPriceId,
      trialPeriodDays: action.trialPeriodDays,
    });
  }

  if (action.type === "update") {
    return ctx.stripe.updateSubscription({
      prorationBehavior: action.prorationBehavior,
      providerPriceId: action.providerPriceId,
      providerSubscriptionId: action.providerSubscriptionId,
    });
  }

  if (action.type === "cancel") {
    return ctx.stripe.cancelSubscription({
      currentPeriodEndAt: action.currentPeriodEndAt,
      providerSubscriptionId: action.providerSubscriptionId,
      providerSubscriptionScheduleId: action.providerSubscriptionScheduleId,
    });
  }

  if (action.type === "schedule_change") {
    return ctx.stripe.scheduleSubscriptionChange({
      providerPriceId: action.providerPriceId,
      providerSubscriptionId: action.providerSubscriptionId,
      providerSubscriptionScheduleId: action.providerSubscriptionScheduleId,
    });
  }

  // resume
  return ctx.stripe.resumeSubscription({
    providerSubscriptionId: action.providerSubscriptionId,
    providerSubscriptionScheduleId: action.providerSubscriptionScheduleId,
  });
}

// ---------------------------------------------------------------------------
// Shared DB mutation executor — used by both direct path and webhook deferred path
// ---------------------------------------------------------------------------

export async function executePayKitPlan(
  ctx: PayKitContext,
  providerId: string,
  plan: PayKitBillingPlan,
  stripeResult: {
    subscription?: ProviderSubscription | null;
    invoice?: {
      providerInvoiceId: string;
      currency: string;
      status: string | null;
      totalAmount: number;
      hostedUrl?: string | null;
      periodStartAt?: Date | null;
      periodEndAt?: Date | null;
    } | null;
  },
  options?: { deferred?: boolean },
): Promise<void> {
  await ctx.database.transaction(async (tx) => {
    // 1. Clear scheduled products in group
    if (plan.clearScheduledInGroup && plan.group) {
      await clearScheduledCustomerProductsInGroup(tx, {
        customerId: plan.customerId,
        group: plan.group,
        providerId,
      });
    }

    // 2. Delete scheduled products in group
    if (plan.deleteScheduledInGroup && plan.group) {
      await deleteScheduledCustomerProductsInGroup(tx, {
        customerId: plan.customerId,
        group: plan.group,
        providerId,
      });
    }

    // 3. Update existing product
    if (plan.updateProduct) {
      const upd = plan.updateProduct;

      if (upd.status === "ended") {
        await endCustomerProducts(tx, [upd.customerProductId], {
          canceled: upd.canceled,
          endedAt: upd.endedAt ?? new Date(),
          status: "ended",
        });
      } else if (upd.canceled) {
        await scheduleCustomerProductCancellation(tx, {
          canceledAt: upd.canceledAt ?? new Date(),
          currentPeriodEndAt: upd.endedAt,
          customerProductId: upd.customerProductId,
        });
        if (upd.scheduledProductId !== undefined) {
          await replaceCurrentProductSchedule(tx, {
            customerProductId: upd.customerProductId,
            scheduledProductId: upd.scheduledProductId,
          });
        }
      } else {
        // Resume: clear cancellation
        await syncCustomerProductFromSubscription(tx, {
          customerProductId: upd.customerProductId,
          subscription: stripeResult.subscription
            ? stripeResult.subscription
            : { cancelAtPeriodEnd: false, providerSubscriptionId: "", status: upd.status },
        });
        await replaceCurrentProductSchedule(tx, {
          customerProductId: upd.customerProductId,
          scheduledProductId: null,
        });
        if (stripeResult.subscription) {
          await syncCustomerProductBillingState(tx, {
            customerProductId: upd.customerProductId,
            currentPeriodEndAt: stripeResult.subscription.currentPeriodEndAt,
            currentPeriodStartAt: stripeResult.subscription.currentPeriodStartAt,
            status: stripeResult.subscription.status,
          });
        }
      }
    }

    // 4. Insert new products and link subscriptions/invoices
    for (const insertOp of plan.insertProducts) {
      // Scheduled products keep their own status and period dates — the Stripe
      // result describes the *existing* subscription (e.g. still "active" after
      // cancel), not the future scheduled product.
      const isScheduled = insertOp.status === "scheduled";
      const periodStart = isScheduled
        ? (insertOp.currentPeriodStartAt ?? null)
        : (stripeResult.subscription?.currentPeriodStartAt ??
          insertOp.currentPeriodStartAt ??
          null);
      const periodEnd = isScheduled
        ? (insertOp.currentPeriodEndAt ?? null)
        : (stripeResult.subscription?.currentPeriodEndAt ?? insertOp.currentPeriodEndAt ?? null);
      const status = isScheduled
        ? insertOp.status
        : (stripeResult.subscription?.status ?? insertOp.status);

      // When a deferred checkout completes, the subscription.created webhook may
      // have already arrived and created the customer product + subscription.
      // Detect this and reuse the existing row instead of inserting a duplicate.
      // Only applies in deferred (webhook) context — direct path always inserts.
      let customerProductRow: { id: string } | null = null;
      if (options?.deferred && !isScheduled && stripeResult.subscription) {
        const existingSub = await getSubscriptionByProviderId(tx, {
          providerId,
          providerSubscriptionId: stripeResult.subscription.providerSubscriptionId,
        });
        if (existingSub?.customerProductId) {
          customerProductRow = { id: existingSub.customerProductId };
          await syncCustomerProductBillingState(tx, {
            customerProductId: existingSub.customerProductId,
            currentPeriodEndAt: periodEnd,
            currentPeriodStartAt: periodStart,
            status,
          });
        }
      }

      if (!customerProductRow) {
        customerProductRow = await insertCustomerProductRecord(tx, {
          currentPeriodEndAt: periodEnd,
          currentPeriodStartAt: periodStart,
          customerId: insertOp.customerId,
          planFeatures: insertOp.planFeatures,
          priceId: insertOp.priceId,
          productInternalId: insertOp.productInternalId,
          providerId: insertOp.providerId,
          startedAt: insertOp.startedAt,
          status,
          subscriptionId: insertOp.subscriptionId ?? null,
          trialEndsAt: insertOp.trialEndsAt ?? null,
        });
      }

      // Only link Stripe subscription/invoice to non-scheduled products — scheduled
      // products will get their own subscription (if any) when they activate.
      if (stripeResult.subscription && !isScheduled) {
        const subscriptionRow = await upsertSubscriptionRecord(tx, {
          customerId: insertOp.customerId,
          customerProductId: customerProductRow.id,
          providerId,
          subscription: stripeResult.subscription,
        });
        await linkCustomerProductSubscription(tx, {
          customerProductId: customerProductRow.id,
          subscriptionId: subscriptionRow.id,
        });

        if (stripeResult.invoice) {
          await upsertInvoiceRecord(tx, {
            customerId: insertOp.customerId,
            invoice: stripeResult.invoice,
            providerId,
            subscriptionId: subscriptionRow.id,
          });
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export async function resolveFallbackSuccessPlanId(
  ctx: PayKitContext,
  group: string,
): Promise<string | null> {
  const fallback = await getDefaultProductInGroup(ctx.database, group, ctx.provider.id);
  return fallback?.id ?? null;
}
