import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import {
  customerEntitlement,
  customerPrice,
  customerProduct,
  invoice,
  metadata,
  subscription,
  webhookEvent,
} from "../database/schema";
import type {
  ProviderInvoice,
  ProviderRequiredAction,
  ProviderSubscription,
} from "../providers/provider";
import type { NormalizedInvoice, NormalizedSubscription } from "../types/events";
import type { StoredCustomerProduct, StoredInvoice, StoredSubscription } from "../types/models";
import type { NormalizedPlanFeature } from "../types/schema";

export type RedirectMode = "always" | "if_required" | "never";

export interface SubscribeResult {
  invoice?: {
    currency: string;
    hostedUrl: string | null;
    providerInvoiceId: string;
    status: string | null;
    totalAmount: number;
  };
  paymentUrl: string | null;
  requiredAction?: ProviderRequiredAction | null;
}

export interface CustomerProductWithCatalog extends StoredCustomerProduct {
  planId: string;
  planGroup: string;
  planIsDefault: boolean;
  planName: string;
  priceAmount: number | null;
  priceId: string | null;
  priceInterval: string | null;
  providerPriceId: string | null;
}

function addResetInterval(date: Date, resetInterval: string): Date {
  const next = new Date(date);
  if (resetInterval === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (resetInterval === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (resetInterval === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  if (resetInterval === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function normalizeInvoice(
  source: ProviderInvoice | NormalizedInvoice,
): SubscribeResult["invoice"] | undefined {
  return {
    currency: source.currency,
    hostedUrl: source.hostedUrl ?? null,
    providerInvoiceId: source.providerInvoiceId,
    status: source.status,
    totalAmount: source.totalAmount,
  };
}

export async function getActiveCustomerProductInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string; providerId: string },
): Promise<CustomerProductWithCatalog | null> {
  const result = (await database.execute(sql`
    select
      cp.id,
      cp.customer_id as "customerId",
      cp.product_internal_id as "productInternalId",
      cp.subscription_id as "subscriptionId",
      cp.provider_id as "providerId",
      cp.provider_checkout_session_id as "providerCheckoutSessionId",
      cp.status,
      cp.canceled,
      cp.started_at as "startedAt",
      cp.trial_ends_at as "trialEndsAt",
      cp.current_period_start_at as "currentPeriodStartAt",
      cp.current_period_end_at as "currentPeriodEndAt",
      cp.canceled_at as "canceledAt",
      cp.ended_at as "endedAt",
      cp.scheduled_product_id as "scheduledProductId",
      cp.quantity,
      cp.created_at as "createdAt",
      cp.updated_at as "updatedAt",
      p.id as "planId",
      p.name as "planName",
      p."group" as "planGroup",
      p.is_default as "planIsDefault",
      pr.id as "priceId",
      pr.amount as "priceAmount",
      pr.interval as "priceInterval",
      ppr.provider_price_id as "providerPriceId"
    from paykit_customer_product cp
    inner join paykit_product p on p.internal_id = cp.product_internal_id
    left join paykit_price pr on pr.product_internal_id = p.internal_id
    left join paykit_provider_price ppr
      on ppr.price_id = pr.id
      and ppr.provider_id = ${input.providerId}
    where cp.customer_id = ${input.customerId}
      and p."group" = ${input.group}
      and cp.status in ('active', 'trialing', 'past_due')
      and (cp.ended_at is null or cp.ended_at > now())
    order by cp.created_at desc
    limit 1
  `)) as unknown as { rows: CustomerProductWithCatalog[] };

  return result.rows[0] ?? null;
}

export async function getScheduledCustomerProductsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string; providerId: string },
): Promise<readonly CustomerProductWithCatalog[]> {
  const result = (await database.execute(sql`
    select
      cp.id,
      cp.customer_id as "customerId",
      cp.product_internal_id as "productInternalId",
      cp.subscription_id as "subscriptionId",
      cp.provider_id as "providerId",
      cp.provider_checkout_session_id as "providerCheckoutSessionId",
      cp.status,
      cp.canceled,
      cp.started_at as "startedAt",
      cp.trial_ends_at as "trialEndsAt",
      cp.current_period_start_at as "currentPeriodStartAt",
      cp.current_period_end_at as "currentPeriodEndAt",
      cp.canceled_at as "canceledAt",
      cp.ended_at as "endedAt",
      cp.scheduled_product_id as "scheduledProductId",
      cp.quantity,
      cp.created_at as "createdAt",
      cp.updated_at as "updatedAt",
      p.id as "planId",
      p.name as "planName",
      p."group" as "planGroup",
      p.is_default as "planIsDefault",
      pr.id as "priceId",
      pr.amount as "priceAmount",
      pr.interval as "priceInterval",
      ppr.provider_price_id as "providerPriceId"
    from paykit_customer_product cp
    inner join paykit_product p on p.internal_id = cp.product_internal_id
    left join paykit_price pr on pr.product_internal_id = p.internal_id
    left join paykit_provider_price ppr
      on ppr.price_id = pr.id
      and ppr.provider_id = ${input.providerId}
    where cp.customer_id = ${input.customerId}
      and p."group" = ${input.group}
      and cp.status = 'scheduled'
      and cp.ended_at is null
    order by cp.created_at desc
  `)) as unknown as { rows: CustomerProductWithCatalog[] };

  return result.rows;
}

export async function getSubscriptionByProviderId(
  database: PayKitDatabase,
  input: { providerId: string; providerSubscriptionId: string },
): Promise<StoredSubscription | null> {
  return (
    (await database.query.subscription.findFirst({
      where: and(
        eq(subscription.providerId, input.providerId),
        eq(subscription.providerSubscriptionId, input.providerSubscriptionId),
      ),
    })) ?? null
  );
}

export async function getInvoiceByProviderId(
  database: PayKitDatabase,
  input: { providerId: string; providerInvoiceId: string },
): Promise<StoredInvoice | null> {
  return (
    (await database.query.invoice.findFirst({
      where: and(
        eq(invoice.providerId, input.providerId),
        eq(invoice.providerInvoiceId, input.providerInvoiceId),
      ),
    })) ?? null
  );
}

export async function getSubscriptionByCustomerProductId(
  database: PayKitDatabase,
  customerProductId: string,
): Promise<StoredSubscription | null> {
  return (
    (await database.query.subscription.findFirst({
      where: eq(subscription.customerProductId, customerProductId),
    })) ?? null
  );
}

export async function getCustomerProductById(
  database: PayKitDatabase,
  customerProductId: string,
): Promise<StoredCustomerProduct | null> {
  return (
    (await database.query.customerProduct.findFirst({
      where: eq(customerProduct.id, customerProductId),
    })) ?? null
  );
}

export async function createMetadata(
  database: PayKitDatabase,
  input: {
    data: Record<string, unknown>;
    expiresAt?: Date;
    providerId: string;
    type: string;
  },
): Promise<{ id: string }> {
  const id = generateId("meta");
  await database.insert(metadata).values({
    createdAt: new Date(),
    data: input.data,
    expiresAt: input.expiresAt ?? null,
    id,
    providerCheckoutSessionId: null,
    providerId: input.providerId,
    type: input.type,
  });
  return { id };
}

export async function linkMetadataToCheckoutSession(
  database: PayKitDatabase,
  input: { id: string; providerCheckoutSessionId: string },
): Promise<void> {
  await database
    .update(metadata)
    .set({ providerCheckoutSessionId: input.providerCheckoutSessionId })
    .where(eq(metadata.id, input.id));
}

export async function getMetadataById(
  database: PayKitDatabase,
  id: string,
): Promise<{
  id: string;
  providerId: string;
  type: string;
  data: Record<string, unknown>;
  providerCheckoutSessionId: string | null;
} | null> {
  const row = await database.query.metadata.findFirst({
    where: eq(metadata.id, id),
  });
  return row
    ? {
        data: row.data,
        id: row.id,
        providerCheckoutSessionId: row.providerCheckoutSessionId,
        providerId: row.providerId,
        type: row.type,
      }
    : null;
}

export async function deleteMetadataById(database: PayKitDatabase, id: string): Promise<void> {
  await database.delete(metadata).where(eq(metadata.id, id));
}

export async function beginWebhookEvent(
  database: PayKitDatabase,
  input: {
    payload: Record<string, unknown>;
    providerEventId: string;
    providerId: string;
    type: string;
  },
): Promise<boolean> {
  try {
    await database.insert(webhookEvent).values({
      error: null,
      id: generateId("evt"),
      payload: input.payload,
      processedAt: null,
      providerEventId: input.providerEventId,
      providerId: input.providerId,
      receivedAt: new Date(),
      status: "processing",
      type: input.type,
    });
    return true;
  } catch (error: unknown) {
    // Unique constraint violation (duplicate event) → already processed
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return false;
    }
    throw error;
  }
}

export async function finishWebhookEvent(
  database: PayKitDatabase,
  input: {
    error?: string;
    providerEventId: string;
    providerId: string;
    status: "failed" | "processed";
  },
): Promise<void> {
  await database
    .update(webhookEvent)
    .set({
      error: input.error ?? null,
      processedAt: new Date(),
      status: input.status,
    })
    .where(
      and(
        eq(webhookEvent.providerId, input.providerId),
        eq(webhookEvent.providerEventId, input.providerEventId),
      ),
    );
}

export async function upsertSubscriptionRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    customerProductId?: string | null;
    providerId: string;
    subscription: ProviderSubscription | NormalizedSubscription;
  },
): Promise<StoredSubscription> {
  const existing = await getSubscriptionByProviderId(database, {
    providerId: input.providerId,
    providerSubscriptionId: input.subscription.providerSubscriptionId,
  });
  const now = new Date();
  const values = {
    cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
    canceledAt:
      input.subscription.canceledAt !== undefined
        ? (input.subscription.canceledAt ?? null)
        : (existing?.canceledAt ?? null),
    currentPeriodEndAt:
      input.subscription.currentPeriodEndAt !== undefined
        ? (input.subscription.currentPeriodEndAt ?? null)
        : (existing?.currentPeriodEndAt ?? null),
    currentPeriodStartAt:
      input.subscription.currentPeriodStartAt !== undefined
        ? (input.subscription.currentPeriodStartAt ?? null)
        : (existing?.currentPeriodStartAt ?? null),
    customerId: input.customerId,
    customerProductId: input.customerProductId ?? null,
    endedAt:
      input.subscription.endedAt !== undefined
        ? (input.subscription.endedAt ?? null)
        : (existing?.endedAt ?? null),
    providerId: input.providerId,
    providerSubscriptionId: input.subscription.providerSubscriptionId,
    providerSubscriptionScheduleId:
      input.subscription.providerSubscriptionScheduleId !== undefined
        ? (input.subscription.providerSubscriptionScheduleId ?? null)
        : (existing?.providerSubscriptionScheduleId ?? null),
    status: input.subscription.status,
    updatedAt: now,
  };

  if (existing) {
    const rows = await database
      .update(subscription)
      .set(values)
      .where(eq(subscription.id, existing.id))
      .returning();
    return rows[0] ?? existing;
  }

  const rows = await database
    .insert(subscription)
    .values({
      ...values,
      createdAt: now,
      id: generateId("sub"),
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create subscription.");
  }
  return row;
}

export async function upsertInvoiceRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    providerId: string;
    subscriptionId?: string | null;
    invoice: ProviderInvoice | NormalizedInvoice;
  },
): Promise<StoredInvoice> {
  const existing = await database.query.invoice.findFirst({
    where: and(
      eq(invoice.providerId, input.providerId),
      eq(invoice.providerInvoiceId, input.invoice.providerInvoiceId),
    ),
  });
  const now = new Date();
  const values = {
    currency: input.invoice.currency,
    customerId: input.customerId,
    hostedUrl: input.invoice.hostedUrl ?? null,
    periodEndAt: input.invoice.periodEndAt ?? null,
    periodStartAt: input.invoice.periodStartAt ?? null,
    providerId: input.providerId,
    providerInvoiceId: input.invoice.providerInvoiceId,
    status: input.invoice.status ?? "open",
    subscriptionId: input.subscriptionId ?? null,
    totalAmount: input.invoice.totalAmount,
    updatedAt: now,
  };

  if (existing) {
    const rows = await database
      .update(invoice)
      .set(values)
      .where(eq(invoice.id, existing.id))
      .returning();
    return rows[0] ?? existing;
  }

  const rows = await database
    .insert(invoice)
    .values({
      ...values,
      createdAt: now,
      id: generateId("inv"),
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create invoice.");
  }
  return row;
}

export async function insertCustomerProductRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    planFeatures: readonly NormalizedPlanFeature[];
    priceId?: string | null;
    productInternalId: string;
    providerCheckoutSessionId?: string | null;
    providerId: string;
    scheduledProductId?: string | null;
    startedAt?: Date | null;
    status: string;
    subscriptionId?: string | null;
    trialEndsAt?: Date | null;
  },
): Promise<StoredCustomerProduct> {
  const now = new Date();
  const rows = await database
    .insert(customerProduct)
    .values({
      canceled: false,
      canceledAt: null,
      createdAt: now,
      currentPeriodEndAt: input.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.currentPeriodStartAt ?? null,
      customerId: input.customerId,
      endedAt: null,
      id: generateId("cp"),
      productInternalId: input.productInternalId,
      providerCheckoutSessionId: input.providerCheckoutSessionId ?? null,
      providerId: input.providerId,
      quantity: 1,
      scheduledProductId: input.scheduledProductId ?? null,
      startedAt: input.startedAt ?? now,
      status: input.status,
      subscriptionId: input.subscriptionId ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      updatedAt: now,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create customer product.");
  }

  if (input.priceId) {
    await database.insert(customerPrice).values({
      createdAt: now,
      customerId: input.customerId,
      customerProductId: row.id,
      id: generateId("cp_price"),
      options: null,
      priceId: input.priceId,
    });
  }

  if (input.planFeatures.length > 0) {
    for (const planFeature of input.planFeatures) {
      await database.insert(customerEntitlement).values({
        balance: planFeature.limit ?? 0,
        createdAt: now,
        customerId: input.customerId,
        customerProductId: row.id,
        featureId: planFeature.id,
        id: generateId("ent"),
        nextResetAt: planFeature.resetInterval
          ? addResetInterval(now, planFeature.resetInterval)
          : null,
        unlimited: planFeature.type === "boolean",
        updatedAt: now,
      });
    }
  }

  return row;
}

export async function endCustomerProducts(
  database: PayKitDatabase,
  customerProductIds: readonly string[],
  input: { canceled?: boolean; endedAt?: Date | null; status: string },
): Promise<void> {
  if (customerProductIds.length === 0) {
    return;
  }

  await database
    .update(customerProduct)
    .set({
      canceled: input.canceled ?? false,
      canceledAt: input.canceled ? new Date() : null,
      endedAt: input.endedAt ?? new Date(),
      status: input.status,
      updatedAt: new Date(),
    })
    .where(inArray(customerProduct.id, [...customerProductIds]));
}

export async function clearScheduledCustomerProductsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string; providerId: string },
): Promise<void> {
  const scheduled = await getScheduledCustomerProductsInGroup(database, input);
  if (scheduled.length === 0) {
    return;
  }

  await endCustomerProducts(
    database,
    scheduled.map((item) => item.id),
    { endedAt: new Date(), status: "canceled" },
  );
}

export async function deleteCustomerProducts(
  database: PayKitDatabase,
  customerProductIds: readonly string[],
): Promise<void> {
  if (customerProductIds.length === 0) {
    return;
  }

  await database
    .delete(customerEntitlement)
    .where(inArray(customerEntitlement.customerProductId, [...customerProductIds]));

  await database
    .delete(customerPrice)
    .where(inArray(customerPrice.customerProductId, [...customerProductIds]));

  await database
    .delete(customerProduct)
    .where(inArray(customerProduct.id, [...customerProductIds]));
}

export async function deleteScheduledCustomerProductsInGroup(
  database: PayKitDatabase,
  input: { customerId: string; group: string; providerId: string },
): Promise<void> {
  const scheduled = await getScheduledCustomerProductsInGroup(database, input);
  if (scheduled.length === 0) {
    return;
  }

  await deleteCustomerProducts(
    database,
    scheduled.map((item) => item.id),
  );
}

export async function scheduleCustomerProductCancellation(
  database: PayKitDatabase,
  input: {
    canceledAt?: Date | null;
    currentPeriodEndAt?: Date | null;
    customerProductId: string;
  },
): Promise<void> {
  const existing = await getCustomerProductById(database, input.customerProductId);
  if (!existing) {
    return;
  }

  await database
    .update(customerProduct)
    .set({
      canceled: true,
      canceledAt: input.canceledAt ?? new Date(),
      endedAt: input.currentPeriodEndAt ?? existing.endedAt,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function replaceCurrentProductSchedule(
  database: PayKitDatabase,
  input: { customerProductId: string; scheduledProductId?: string | null },
): Promise<void> {
  await database
    .update(customerProduct)
    .set({
      scheduledProductId: input.scheduledProductId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function linkCustomerProductSubscription(
  database: PayKitDatabase,
  input: { customerProductId: string; subscriptionId: string | null },
): Promise<void> {
  await database
    .update(customerProduct)
    .set({
      subscriptionId: input.subscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function activateScheduledCustomerProduct(
  database: PayKitDatabase,
  input: {
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    customerProductId: string;
    startedAt?: Date | null;
    status: string;
    subscriptionId?: string | null;
  },
): Promise<void> {
  await database
    .update(customerProduct)
    .set({
      canceled: false,
      canceledAt: null,
      currentPeriodEndAt: input.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.currentPeriodStartAt ?? null,
      endedAt: null,
      startedAt: input.startedAt ?? new Date(),
      status: input.status,
      subscriptionId: input.subscriptionId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function getScheduledCustomerProductsReadyForSubscription(
  database: PayKitDatabase,
  input: {
    customerId: string;
    group: string;
    now: Date;
    providerId: string;
  },
): Promise<readonly CustomerProductWithCatalog[]> {
  const result = (await database.execute(sql`
    select
      cp.id,
      cp.customer_id as "customerId",
      cp.product_internal_id as "productInternalId",
      cp.subscription_id as "subscriptionId",
      cp.provider_id as "providerId",
      cp.provider_checkout_session_id as "providerCheckoutSessionId",
      cp.status,
      cp.canceled,
      cp.started_at as "startedAt",
      cp.trial_ends_at as "trialEndsAt",
      cp.current_period_start_at as "currentPeriodStartAt",
      cp.current_period_end_at as "currentPeriodEndAt",
      cp.canceled_at as "canceledAt",
      cp.ended_at as "endedAt",
      cp.scheduled_product_id as "scheduledProductId",
      cp.quantity,
      cp.created_at as "createdAt",
      cp.updated_at as "updatedAt",
      p.id as "planId",
      p.name as "planName",
      p."group" as "planGroup",
      p.is_default as "planIsDefault",
      pr.id as "priceId",
      pr.amount as "priceAmount",
      pr.interval as "priceInterval",
      ppr.provider_price_id as "providerPriceId"
    from paykit_customer_product cp
    inner join paykit_product p on p.internal_id = cp.product_internal_id
    left join paykit_price pr on pr.product_internal_id = p.internal_id
    left join paykit_provider_price ppr
      on ppr.price_id = pr.id
      and ppr.provider_id = ${input.providerId}
    where cp.customer_id = ${input.customerId}
      and p."group" = ${input.group}
      and cp.status = 'scheduled'
      and cp.ended_at is null
      and (cp.started_at is null or cp.started_at <= ${input.now})
    order by cp.created_at desc
  `)) as unknown as { rows: CustomerProductWithCatalog[] };

  return result.rows;
}

export async function getCustomerProductsForSubscription(
  database: PayKitDatabase,
  input: { customerId: string; subscriptionId: string },
): Promise<readonly StoredCustomerProduct[]> {
  return database.query.customerProduct.findMany({
    where: and(
      eq(customerProduct.customerId, input.customerId),
      eq(customerProduct.subscriptionId, input.subscriptionId),
      isNull(customerProduct.endedAt),
    ),
  });
}

export async function syncCustomerProductFromSubscription(
  database: PayKitDatabase,
  input: {
    customerProductId: string;
    subscription: ProviderSubscription | NormalizedSubscription;
  },
): Promise<void> {
  const endedAt =
    input.subscription.cancelAtPeriodEnd === false ? null : (input.subscription.endedAt ?? null);
  const canceledAt =
    input.subscription.cancelAtPeriodEnd === false ? null : (input.subscription.canceledAt ?? null);

  await database
    .update(customerProduct)
    .set({
      canceled: input.subscription.cancelAtPeriodEnd,
      canceledAt,
      currentPeriodEndAt: input.subscription.currentPeriodEndAt ?? null,
      currentPeriodStartAt: input.subscription.currentPeriodStartAt ?? null,
      endedAt,
      status: input.subscription.status,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function syncCustomerProductBillingState(
  database: PayKitDatabase,
  input: {
    customerProductId: string;
    currentPeriodEndAt?: Date | null;
    currentPeriodStartAt?: Date | null;
    providerCheckoutSessionId?: string | null;
    startedAt?: Date | null;
    status?: string;
    subscriptionId?: string | null;
  },
): Promise<void> {
  const existing = await database.query.customerProduct.findFirst({
    where: eq(customerProduct.id, input.customerProductId),
  });
  if (!existing) {
    return;
  }

  await database
    .update(customerProduct)
    .set({
      currentPeriodEndAt:
        input.currentPeriodEndAt !== undefined
          ? input.currentPeriodEndAt
          : existing.currentPeriodEndAt,
      currentPeriodStartAt:
        input.currentPeriodStartAt !== undefined
          ? input.currentPeriodStartAt
          : existing.currentPeriodStartAt,
      providerCheckoutSessionId:
        input.providerCheckoutSessionId !== undefined
          ? input.providerCheckoutSessionId
          : existing.providerCheckoutSessionId,
      startedAt: input.startedAt !== undefined ? input.startedAt : existing.startedAt,
      status: input.status ?? existing.status,
      subscriptionId:
        input.subscriptionId !== undefined ? input.subscriptionId : existing.subscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(customerProduct.id, input.customerProductId));
}

export async function getCurrentCustomerPlans(
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
  const result = (await database.execute(sql`
    select
      p.id,
      cp.status,
      cp.started_at as "startedAt",
      cp.current_period_end_at as "currentPeriodEndAt",
      cp.ended_at as "endedAt"
    from paykit_customer_product cp
    inner join paykit_product p on p.internal_id = cp.product_internal_id
    where cp.customer_id = ${customerId}
      and (cp.ended_at is null or cp.ended_at > now() or cp.status = 'scheduled')
    order by cp.created_at desc
  `)) as unknown as {
    rows: Array<{
      currentPeriodEndAt: Date | null;
      endedAt: Date | null;
      id: string;
      startedAt: Date | null;
      status: string;
    }>;
  };

  return result.rows;
}

export function buildSubscribeResult(input: {
  invoice?: ProviderInvoice | NormalizedInvoice | null;
  paymentUrl: string | null;
  requiredAction?: ProviderRequiredAction | null;
}): SubscribeResult {
  return {
    invoice: input.invoice ? normalizeInvoice(input.invoice) : undefined,
    paymentUrl: input.paymentUrl,
    requiredAction: input.requiredAction ?? null,
  };
}
