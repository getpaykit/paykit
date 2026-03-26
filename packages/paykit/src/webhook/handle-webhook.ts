import { and, desc, eq, isNull } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { customerProduct, product, subscription as subscriptionTable } from "../database/schema";
import {
  activateScheduledCustomerProduct,
  beginWebhookEvent,
  deleteMetadataById,
  deleteScheduledCustomerProductsInGroup,
  endCustomerProducts,
  finishWebhookEvent,
  getActiveCustomerProductInGroup,
  getCustomerProductById,
  getCurrentCustomerPlans,
  getMetadataById,
  getScheduledCustomerProductsInGroup,
  getSubscriptionByProviderId,
  insertCustomerProductRecord,
  linkCustomerProductSubscription,
  replaceCurrentProductSchedule,
  scheduleCustomerProductCancellation,
  syncCustomerProductBillingState,
  syncCustomerProductFromSubscription,
  upsertInvoiceRecord,
  upsertSubscriptionRecord,
} from "../services/billing-service";
import {
  deleteCustomerById,
  getProviderCustomerByProviderCustomerId,
  syncCustomer,
} from "../services/customer-service";
import {
  deletePaymentMethodByProviderId,
  syncPaymentMethodByProviderCustomer,
} from "../services/payment-method-service";
import { syncPaymentByProviderCustomer } from "../services/payment-service";
import {
  getDefaultProductInGroup,
  getLatestProductWithPrice,
  getProductByProviderPriceId,
} from "../services/product-service";
import { executePayKitPlan, executeStripeAction } from "../services/subscribe-service";
import { deserializeBillingPlan } from "../types/billing-plan";
import type {
  AnyNormalizedWebhookEvent,
  NormalizedWebhookEvent,
  WebhookApplyAction,
} from "../types/events";

export interface HandleWebhookInput {
  body: string;
  headers: Record<string, string>;
}

async function emitCustomerUpdated(ctx: PayKitContext, customerId: string): Promise<void> {
  const plans = await getCurrentCustomerPlans(ctx.database, customerId);
  const payload = { customerId, plans };

  await ctx.options.on?.["customer.updated"]?.({
    name: "customer.updated",
    payload,
  });
  await ctx.options.on?.["*"]?.({
    event: {
      name: "customer.updated",
      payload,
    },
  });
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
  const existingScheduled = await getScheduledCustomerProductsInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.group,
    providerId: ctx.provider.id,
  });
  if (existingScheduled.length > 0) {
    return;
  }

  const defaultPlan = await getDefaultProductInGroup(ctx.database, input.group, ctx.provider.id);
  if (!defaultPlan || defaultPlan.priceId !== null) {
    return;
  }

  const normalizedPlan = ctx.plans.plans.find((plan) => plan.id === defaultPlan.id);
  if (!normalizedPlan) {
    return;
  }

  await insertCustomerProductRecord(ctx.database, {
    customerId: input.customerId,
    planFeatures: normalizedPlan.includes,
    productInternalId: defaultPlan.internalId,
    providerId: ctx.provider.id,
    startedAt: input.startsAt,
    status: "scheduled",
  });
}

async function activateScheduledCustomerProductForGroup(
  ctx: PayKitContext,
  input: {
    customerId: string;
    productGroup: string;
    productInternalId?: string | null;
    subscriptionId: string | null;
    subscriptionStatus: string;
    subscriptionCurrentPeriodEndAt?: Date | null;
    subscriptionCurrentPeriodStartAt?: Date | null;
  },
): Promise<string | null> {
  const activationDate = getSubscriptionEffectiveDate({
    currentPeriodEndAt: input.subscriptionCurrentPeriodEndAt,
    currentPeriodStartAt: input.subscriptionCurrentPeriodStartAt,
  });
  const scheduledProducts = await getScheduledCustomerProductsInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.productGroup,
    providerId: ctx.provider.id,
  });

  const targetProduct = scheduledProducts.find((scheduledProduct) => {
    if (scheduledProduct.startedAt && scheduledProduct.startedAt > activationDate) {
      return false;
    }

    if (!input.productInternalId) {
      return true;
    }

    return scheduledProduct.productInternalId === input.productInternalId;
  });

  if (!targetProduct) {
    return null;
  }

  const activeProduct = await getActiveCustomerProductInGroup(ctx.database, {
    customerId: input.customerId,
    group: input.productGroup,
    providerId: ctx.provider.id,
  });

  if (activeProduct && activeProduct.id !== targetProduct.id) {
    await endCustomerProducts(ctx.database, [activeProduct.id], {
      canceled: activeProduct.canceled,
      endedAt: activationDate,
      status: "ended",
    });
  }

  await activateScheduledCustomerProduct(ctx.database, {
    currentPeriodEndAt: input.subscriptionCurrentPeriodEndAt,
    currentPeriodStartAt: input.subscriptionCurrentPeriodStartAt,
    customerProductId: targetProduct.id,
    startedAt: targetProduct.startedAt ?? activationDate,
    status: input.subscriptionStatus,
    subscriptionId: input.subscriptionId,
  });

  return targetProduct.id;
}

function getProviderEventId(
  event: AnyNormalizedWebhookEvent,
  index: number,
  parentEventId: string | null,
): string {
  const payload = event.payload as Record<string, unknown>;
  const providerEventId = payload.providerEventId;
  if (typeof providerEventId === "string" && providerEventId.length > 0) {
    return providerEventId;
  }
  // Synthetic sub-events (e.g. from checkout expansion) include the parent's
  // provider event ID to avoid collisions across different webhook deliveries.
  const prefix = parentEventId ?? "unknown";
  return `${prefix}:${event.name}:${index}`;
}

async function finalizeSubscriptionCheckout(
  ctx: PayKitContext,
  event: NormalizedWebhookEvent<"checkout.completed">,
): Promise<string | null> {
  if (event.payload.mode !== "subscription") {
    return null;
  }

  const metadataId = event.payload.metadata?.paykit_metadata_id;
  if (!metadataId) {
    return null;
  }

  const storedMetadata = await getMetadataById(ctx.database, metadataId);
  if (!storedMetadata) {
    return null;
  }

  const metadataType =
    typeof storedMetadata.data.type === "string" ? storedMetadata.data.type : null;

  // --- New deferred billing plan path ---
  if (metadataType === "subscribe_deferred") {
    const billingPlan = deserializeBillingPlan(storedMetadata.data.billingPlan as unknown);
    const checkoutSubscription = event.payload.subscription ?? null;
    const checkoutInvoice = event.payload.invoice ?? null;

    // Cancel the old subscription if this was a checkout upgrade (e.g. pro → ultra).
    if (billingPlan.stripe.subscriptionAction.type !== "none") {
      await executeStripeAction(ctx, billingPlan.stripe.subscriptionAction);
    }

    await executePayKitPlan(
      ctx,
      ctx.provider.id,
      billingPlan.paykit,
      {
        invoice: checkoutInvoice,
        subscription: checkoutSubscription,
      },
      { deferred: true },
    );

    await deleteMetadataById(ctx.database, metadataId);
    return billingPlan.paykit.customerId;
  }

  // --- Legacy metadata path (backward compat for old subscribe_new / subscribe_upgrade) ---
  return finalizeLegacyCheckout(ctx, event, storedMetadata);
}

async function finalizeLegacyCheckout(
  ctx: PayKitContext,
  event: NormalizedWebhookEvent<"checkout.completed">,
  storedMetadata: { data: Record<string, unknown>; id: string },
): Promise<string | null> {
  const customerId =
    typeof storedMetadata.data.customerId === "string"
      ? storedMetadata.data.customerId
      : event.payload.metadata?.paykit_customer_id;
  const planId =
    typeof storedMetadata.data.planId === "string"
      ? storedMetadata.data.planId
      : event.payload.metadata?.paykit_plan_id;

  if (!customerId || !planId) {
    return null;
  }

  const existingCustomerProduct = await ctx.database.query.customerProduct.findFirst({
    where: and(
      eq(customerProduct.providerId, ctx.provider.id),
      eq(customerProduct.providerCheckoutSessionId, event.payload.checkoutSessionId),
    ),
  });

  const storedPlan = await getLatestProductWithPrice(ctx.database, {
    id: planId,
    providerId: ctx.provider.id,
  });
  const normalizedPlan = ctx.plans.plans.find((plan) => plan.id === planId);
  const existingSubscription = event.payload.providerSubscriptionId
    ? await getSubscriptionByProviderId(ctx.database, {
        providerId: ctx.provider.id,
        providerSubscriptionId: event.payload.providerSubscriptionId,
      })
    : null;
  const checkoutSubscription = event.payload.subscription ?? null;
  const checkoutInvoice = event.payload.invoice ?? null;

  const pendingCustomerProduct =
    !existingCustomerProduct && storedPlan
      ? await ctx.database.query.customerProduct.findFirst({
          where: and(
            eq(customerProduct.customerId, customerId),
            eq(customerProduct.productInternalId, storedPlan.internalId),
            isNull(customerProduct.endedAt),
          ),
          orderBy(fields) {
            return [desc(fields.createdAt)];
          },
        })
      : null;

  if (storedPlan && normalizedPlan) {
    const currentPeriodStartAt =
      checkoutSubscription?.currentPeriodStartAt ??
      existingSubscription?.currentPeriodStartAt ??
      null;
    const currentPeriodEndAt =
      checkoutSubscription?.currentPeriodEndAt ?? existingSubscription?.currentPeriodEndAt ?? null;
    const currentGroupActiveProduct = storedPlan.group
      ? await getActiveCustomerProductInGroup(ctx.database, {
          customerId,
          group: storedPlan.group,
          providerId: ctx.provider.id,
        })
      : null;
    const targetCustomerProduct =
      existingCustomerProduct ??
      pendingCustomerProduct ??
      (await insertCustomerProductRecord(ctx.database, {
        currentPeriodEndAt,
        currentPeriodStartAt,
        customerId,
        planFeatures: normalizedPlan.includes,
        priceId: storedPlan.priceId,
        productInternalId: storedPlan.internalId,
        providerCheckoutSessionId: event.payload.checkoutSessionId,
        providerId: ctx.provider.id,
        startedAt: currentPeriodStartAt ?? new Date(),
        status: checkoutSubscription?.status ?? existingSubscription?.status ?? "active",
        subscriptionId: existingSubscription?.id ?? null,
      }));

    if (
      currentGroupActiveProduct &&
      currentGroupActiveProduct.id !== targetCustomerProduct.id &&
      currentGroupActiveProduct.productInternalId !== targetCustomerProduct.productInternalId
    ) {
      await endCustomerProducts(ctx.database, [currentGroupActiveProduct.id], {
        canceled: false,
        endedAt: currentPeriodStartAt ?? new Date(),
        status: "ended",
      });
    }

    await syncCustomerProductBillingState(ctx.database, {
      customerProductId: targetCustomerProduct.id,
      currentPeriodEndAt,
      currentPeriodStartAt,
      providerCheckoutSessionId: event.payload.checkoutSessionId,
      startedAt: currentPeriodStartAt ?? targetCustomerProduct.startedAt,
      status:
        checkoutSubscription?.status ??
        existingSubscription?.status ??
        targetCustomerProduct.status,
      subscriptionId: existingSubscription?.id ?? targetCustomerProduct.subscriptionId,
    });

    const subscriptionRow = checkoutSubscription
      ? await upsertSubscriptionRecord(ctx.database, {
          customerId,
          customerProductId: targetCustomerProduct.id,
          providerId: ctx.provider.id,
          subscription: checkoutSubscription,
        })
      : existingSubscription;

    if (subscriptionRow) {
      await linkCustomerProductSubscription(ctx.database, {
        customerProductId: targetCustomerProduct.id,
        subscriptionId: subscriptionRow.id,
      });
    }

    if (checkoutInvoice) {
      await upsertInvoiceRecord(ctx.database, {
        customerId,
        invoice: checkoutInvoice,
        providerId: ctx.provider.id,
        subscriptionId: subscriptionRow?.id ?? null,
      });
    }
  }

  await deleteMetadataById(ctx.database, storedMetadata.id);
  return customerId;
}

async function applyAction(ctx: PayKitContext, action: WebhookApplyAction): Promise<string | null> {
  if (action.type === "customer.upsert") {
    await syncCustomer(ctx.database, action.data);
    return action.data.id;
  }

  if (action.type === "customer.delete") {
    await deleteCustomerById(ctx.database, action.data.id);
    return action.data.id;
  }

  if (action.type === "payment_method.upsert") {
    await syncPaymentMethodByProviderCustomer(ctx.database, {
      paymentMethod: action.data.paymentMethod,
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });

    const mapping = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });
    return mapping?.customerId ?? null;
  }

  if (action.type === "payment_method.delete") {
    await deletePaymentMethodByProviderId(ctx.database, {
      providerId: ctx.provider.id,
      providerMethodId: action.data.providerMethodId,
    });
    return null;
  }

  if (action.type === "payment.upsert") {
    await syncPaymentByProviderCustomer(ctx.database, {
      payment: action.data.payment,
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });

    const mapping = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });
    return mapping?.customerId ?? null;
  }

  if (action.type === "subscription.upsert") {
    const mapping = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });
    if (!mapping) {
      return null;
    }

    const existingSubscription = await getSubscriptionByProviderId(ctx.database, {
      providerId: ctx.provider.id,
      providerSubscriptionId: action.data.subscription.providerSubscriptionId,
    });
    const storedProduct = action.data.subscription.providerPriceId
      ? await getProductByProviderPriceId(ctx.database, {
          providerId: ctx.provider.id,
          providerPriceId: action.data.subscription.providerPriceId,
        })
      : null;
    const normalizedPlan = storedProduct
      ? ctx.plans.plans.find((plan) => plan.id === storedProduct.id)
      : null;

    let customerProductId = existingSubscription?.customerProductId ?? null;
    if (!customerProductId) {
      let pendingCustomerProduct = null;

      if (storedProduct) {
        pendingCustomerProduct = storedProduct
          ? await ctx.database.query.customerProduct.findFirst({
              where: and(
                eq(customerProduct.customerId, mapping.customerId),
                eq(customerProduct.productInternalId, storedProduct.internalId),
                isNull(customerProduct.subscriptionId),
                isNull(customerProduct.endedAt),
              ),
              orderBy(fields) {
                return [desc(fields.createdAt)];
              },
            })
          : null;

        if (!pendingCustomerProduct && storedProduct && normalizedPlan) {
          pendingCustomerProduct = await insertCustomerProductRecord(ctx.database, {
            currentPeriodEndAt: action.data.subscription.currentPeriodEndAt ?? null,
            currentPeriodStartAt: action.data.subscription.currentPeriodStartAt ?? null,
            customerId: mapping.customerId,
            planFeatures: normalizedPlan.includes,
            priceId: storedProduct.priceId,
            productInternalId: storedProduct.internalId,
            providerId: ctx.provider.id,
            startedAt: action.data.subscription.currentPeriodStartAt ?? new Date(),
            status: action.data.subscription.status,
            trialEndsAt: null,
          });
        }
      }

      customerProductId = pendingCustomerProduct?.id ?? null;
    }

    const subscriptionRow = await upsertSubscriptionRecord(ctx.database, {
      customerId: mapping.customerId,
      customerProductId,
      providerId: ctx.provider.id,
      subscription: action.data.subscription,
    });

    // Detect a genuine resume: cancel_at_period_end went from true → false
    // AND the subscription is NOT now managed by a schedule. When a schedule is
    // created from a canceled subscription, Stripe un-cancels it automatically —
    // that is NOT a resume, it's a schedule taking over lifecycle management.
    const isGenuineResume =
      storedProduct &&
      existingSubscription?.cancelAtPeriodEnd &&
      !action.data.subscription.cancelAtPeriodEnd &&
      !action.data.subscription.providerSubscriptionScheduleId;

    if (isGenuineResume) {
      await deleteScheduledCustomerProductsInGroup(ctx.database, {
        customerId: mapping.customerId,
        group: storedProduct.group,
        providerId: ctx.provider.id,
      });

      const activeProduct = await getActiveCustomerProductInGroup(ctx.database, {
        customerId: mapping.customerId,
        group: storedProduct.group,
        providerId: ctx.provider.id,
      });
      if (activeProduct) {
        await replaceCurrentProductSchedule(ctx.database, {
          customerProductId: activeProduct.id,
          scheduledProductId: null,
        });
      }
    }

    if (customerProductId) {
      await linkCustomerProductSubscription(ctx.database, {
        customerProductId,
        subscriptionId: subscriptionRow.id,
      });
      await syncCustomerProductFromSubscription(ctx.database, {
        customerProductId,
        subscription: action.data.subscription,
      });
    }

    if (storedProduct) {
      const activeProduct = await getActiveCustomerProductInGroup(ctx.database, {
        customerId: mapping.customerId,
        group: storedProduct.group,
        providerId: ctx.provider.id,
      });

      if (action.data.subscription.cancelAtPeriodEnd && activeProduct) {
        await scheduleCustomerProductCancellation(ctx.database, {
          canceledAt: action.data.subscription.canceledAt ?? new Date(),
          currentPeriodEndAt:
            action.data.subscription.currentPeriodEndAt ?? activeProduct.currentPeriodEndAt,
          customerProductId: activeProduct.id,
        });

        await ensureScheduledDefaultPlan(ctx, {
          customerId: mapping.customerId,
          group: storedProduct.group,
          startsAt:
            action.data.subscription.currentPeriodEndAt ??
            activeProduct.currentPeriodEndAt ??
            new Date(),
        });
      }

      const activatedCustomerProductId = await activateScheduledCustomerProductForGroup(ctx, {
        customerId: mapping.customerId,
        productGroup: storedProduct.group,
        productInternalId: storedProduct.internalId,
        subscriptionCurrentPeriodEndAt: action.data.subscription.currentPeriodEndAt,
        subscriptionCurrentPeriodStartAt: action.data.subscription.currentPeriodStartAt,
        subscriptionId: subscriptionRow.id,
        subscriptionStatus: action.data.subscription.status,
      });

      if (activatedCustomerProductId) {
        await linkCustomerProductSubscription(ctx.database, {
          customerProductId: activatedCustomerProductId,
          subscriptionId: subscriptionRow.id,
        });
        await syncCustomerProductFromSubscription(ctx.database, {
          customerProductId: activatedCustomerProductId,
          subscription: action.data.subscription,
        });
      }
    }

    return mapping.customerId;
  }

  if (action.type === "subscription.delete") {
    const mapping = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });
    if (!mapping) {
      return null;
    }

    const existingSubscription = await getSubscriptionByProviderId(ctx.database, {
      providerId: ctx.provider.id,
      providerSubscriptionId: action.data.providerSubscriptionId,
    });
    if (!existingSubscription) {
      return mapping.customerId;
    }

    const existingCustomerProduct = existingSubscription.customerProductId
      ? await getCustomerProductById(ctx.database, existingSubscription.customerProductId)
      : null;

    if (existingCustomerProduct) {
      await endCustomerProducts(ctx.database, [existingCustomerProduct.id], {
        canceled: true,
        endedAt: new Date(),
        status: "canceled",
      });

      const existingStoredProduct = await ctx.database.query.product.findFirst({
        where: eq(product.internalId, existingCustomerProduct.productInternalId),
      });
      const productGroup = existingStoredProduct?.group ?? "";

      if (productGroup) {
        await ensureScheduledDefaultPlan(ctx, {
          customerId: mapping.customerId,
          group: productGroup,
          startsAt: new Date(),
        });

        const activatedCustomerProductId = await activateScheduledCustomerProductForGroup(ctx, {
          customerId: mapping.customerId,
          productGroup,
          subscriptionId: null,
          subscriptionStatus: "active",
        });

        if (activatedCustomerProductId) {
          await linkCustomerProductSubscription(ctx.database, {
            customerProductId: activatedCustomerProductId,
            subscriptionId: null,
          });
        }
      }
    }

    await ctx.database
      .update(subscriptionTable)
      .set({
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        endedAt: new Date(),
        status: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(subscriptionTable.id, existingSubscription.id));

    return mapping.customerId;
  }

  if (action.type === "invoice.upsert") {
    const mapping = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: action.data.providerCustomerId,
      providerId: ctx.provider.id,
    });
    if (!mapping) {
      return null;
    }

    const subscriptionRecord = action.data.providerSubscriptionId
      ? await getSubscriptionByProviderId(ctx.database, {
          providerId: ctx.provider.id,
          providerSubscriptionId: action.data.providerSubscriptionId,
        })
      : null;

    await upsertInvoiceRecord(ctx.database, {
      customerId: mapping.customerId,
      invoice: action.data.invoice,
      providerId: ctx.provider.id,
      subscriptionId: subscriptionRecord?.id ?? null,
    });
    return mapping.customerId;
  }

  return null;
}

export async function handleWebhook(
  ctx: PayKitContext,
  input: HandleWebhookInput,
): Promise<{ received: true }> {
  const events = await ctx.stripe.handleWebhook({
    body: input.body,
    headers: input.headers,
  });

  // The first event in the batch is the primary webhook event and carries the
  // real provider event ID. Synthetic sub-events reference it as a namespace.
  const primaryPayload = events[0]?.payload as Record<string, unknown> | undefined;
  const parentEventId =
    typeof primaryPayload?.providerEventId === "string" ? primaryPayload.providerEventId : null;

  for (const [index, event] of events.entries()) {
    const providerEventId = getProviderEventId(event, index, parentEventId);
    const shouldProcess = await beginWebhookEvent(ctx.database, {
      payload: event.payload as Record<string, unknown>,
      providerEventId,
      providerId: ctx.provider.id,
      type: event.name,
    });
    if (!shouldProcess) {
      continue;
    }

    try {
      const customerIds = new Set<string>();

      if (event.name === "checkout.completed") {
        const customerId = await finalizeSubscriptionCheckout(ctx, event);
        if (customerId) {
          customerIds.add(customerId);
        }
      }

      for (const action of event.actions ?? []) {
        const customerId = await applyAction(ctx, action);
        if (customerId) {
          customerIds.add(customerId);
        }
      }

      for (const customerId of customerIds) {
        await emitCustomerUpdated(ctx, customerId);
      }

      await finishWebhookEvent(ctx.database, {
        providerEventId,
        providerId: ctx.provider.id,
        status: "processed",
      });
    } catch (error) {
      await finishWebhookEvent(ctx.database, {
        error: error instanceof Error ? error.message : String(error),
        providerEventId,
        providerId: ctx.provider.id,
        status: "failed",
      });
      throw error;
    }
  }

  return { received: true };
}
