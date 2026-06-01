import { and, count, countDistinct, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { PayKitDatabase } from "../database";
import {
  customer,
  entitlement,
  invoice,
  paymentMethod,
  product,
  subscription,
} from "../database/schema";
import { getProductByHash } from "../product/product.service";
import { assertProviderHasCapability } from "../providers/capabilities";
import type { ProviderCustomer, ProviderCustomerMap } from "../providers/provider";
import {
  getActiveSubscriptionInGroup,
  getCurrentSubscriptions,
  getScheduledSubscriptionsInGroup,
  insertSubscriptionRecord,
} from "../subscription/subscription.service";
import type { Customer } from "../types/models";
import type {
  CustomerEntitlement,
  CustomerSubscription,
  CustomerWithDetails,
  ListCustomersResult,
} from "./customer.types";

function stableStringify(value: Record<string, string> | null | undefined): string {
  if (value == null) return "null";
  // oxlint-disable-next-line unicorn/no-array-sort -- already a new array via Object.keys
  const sorted = Object.keys(value).sort();
  return JSON.stringify(value, sorted);
}

function appendEntitlement(
  entitlements: Record<string, CustomerEntitlement>,
  row: {
    balance: number | null;
    featureId: string;
    limit: number | null;
    nextResetAt: Date | null;
  },
): void {
  const isUnlimited = row.limit === null;
  const existing = entitlements[row.featureId];

  if (!existing) {
    entitlements[row.featureId] = {
      featureId: row.featureId,
      balance: row.balance ?? 0,
      limit: row.limit ?? 0,
      usage: isUnlimited ? 0 : (row.limit ?? 0) - (row.balance ?? 0),
      unlimited: isUnlimited,
      nextResetAt: row.nextResetAt,
    };
    return;
  }

  existing.balance += row.balance ?? 0;
  existing.limit += row.limit ?? 0;
  existing.usage += isUnlimited ? 0 : (row.limit ?? 0) - (row.balance ?? 0);
  existing.unlimited ||= isUnlimited;

  if (existing.unlimited) {
    existing.limit = 0;
    existing.usage = 0;
    existing.nextResetAt = null;
    return;
  }

  if (
    row.nextResetAt &&
    (!existing.nextResetAt || row.nextResetAt.getTime() < existing.nextResetAt.getTime())
  ) {
    existing.nextResetAt = row.nextResetAt;
  }
}

export async function syncCustomer(
  database: PayKitDatabase,
  input: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  },
): Promise<Customer> {
  const now = new Date();
  const existing = await database.query.customer.findFirst({
    where: eq(customer.id, input.id),
  });

  if (existing) {
    const rows = await database
      .update(customer)
      .set({
        email: input.email ?? existing.email ?? null,
        name: input.name ?? existing.name ?? null,
        metadata: input.metadata ?? existing.metadata ?? null,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(customer.id, existing.id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.CUSTOMER_UPDATE_FAILED);
    }
    return row;
  }

  const rows = await database
    .insert(customer)
    .values({
      id: input.id,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
      deletedAt: null,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED);
  }
  return row;
}

export async function ensureDefaultPlansForCustomer(
  ctx: PayKitContext,
  customerId: string,
): Promise<void> {
  const defaultPlans = ctx.products.plans.filter((plan) => plan.isDefault);
  if (defaultPlans.length === 0) {
    return;
  }

  for (const defaultPlan of defaultPlans) {
    if (!defaultPlan.group) {
      continue;
    }

    const activeSub = await getActiveSubscriptionInGroup(ctx.database, {
      customerId,
      group: defaultPlan.group,
    });
    if (activeSub) {
      continue;
    }

    const scheduledSubs = await getScheduledSubscriptionsInGroup(ctx.database, {
      customerId,
      group: defaultPlan.group,
    });
    if (scheduledSubs.length > 0) {
      continue;
    }

    const storedPlan = await getProductByHash(ctx.database, defaultPlan.id, defaultPlan.hash);
    if (!storedPlan) {
      continue;
    }

    if (storedPlan.priceAmount !== null) {
      ctx.logger.warn(
        { planId: defaultPlan.id, customerId },
        "skipping default plan: paid default plans are not auto-attached yet",
      );
      continue;
    }

    await insertSubscriptionRecord(ctx.database, {
      customerId,
      planFeatures: defaultPlan.includes,
      productInternalId: storedPlan.internalId,
      startedAt: new Date(),
      status: "active",
    });
  }
}

export async function upsertCustomer(
  ctx: PayKitContext,
  input: Parameters<typeof syncCustomer>[1] & { upsertProviderCustomer?: boolean },
): Promise<Customer> {
  const syncedCustomer = await syncCustomer(ctx.database, input);
  await ensureDefaultPlansForCustomer(ctx, syncedCustomer.id);

  if (input.upsertProviderCustomer) {
    await upsertProviderCustomer(ctx, {
      customerId: syncedCustomer.id,
      customerRow: syncedCustomer,
    });
  }

  return syncedCustomer;
}

export async function getCustomerById(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer | null> {
  return (
    (await database.query.customer.findFirst({
      where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
    })) ?? null
  );
}

export async function getCustomerByIdOrThrow(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer> {
  const existingCustomer = await getCustomerById(database, customerId);
  if (!existingCustomer) {
    throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.CUSTOMER_NOT_FOUND);
  }

  return existingCustomer;
}

export async function getCustomerWithDetails(
  ctx: PayKitContext,
  customerId: string,
): Promise<CustomerWithDetails | null> {
  const customerRow = await getCustomerById(ctx.database, customerId);
  if (!customerRow) return null;

  const subRows = await ctx.database
    .select({
      planGroup: product.group,
      planId: product.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStartAt,
      currentPeriodEnd: subscription.currentPeriodEndAt,
    })
    .from(subscription)
    .innerJoin(product, eq(product.internalId, subscription.productInternalId))
    .where(
      and(
        eq(subscription.customerId, customerId),
        inArray(subscription.status, ["active", "trialing", "past_due", "scheduled"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    )
    .orderBy(desc(subscription.createdAt));

  const subscriptionsByGroup = new Map<string, string[]>();
  for (const row of subRows) {
    if (row.status === "scheduled") continue;
    const currentGroup = subscriptionsByGroup.get(row.planGroup) ?? [];
    currentGroup.push(row.planId);
    subscriptionsByGroup.set(row.planGroup, currentGroup);
  }

  for (const [group, planIds] of subscriptionsByGroup) {
    if (planIds.length < 2) {
      continue;
    }

    ctx.logger.warn(
      {
        customerId,
        group,
        planIds,
      },
      "multiple active subscriptions detected while reading customer details",
    );
  }

  const entRows = await ctx.database
    .select({
      featureId: entitlement.featureId,
      balance: entitlement.balance,
      limit: entitlement.limit,
      nextResetAt: entitlement.nextResetAt,
    })
    .from(entitlement)
    .innerJoin(subscription, eq(subscription.id, entitlement.subscriptionId))
    .where(
      and(
        eq(entitlement.customerId, customerId),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    );

  const entitlements: Record<string, CustomerEntitlement> = {};
  for (const row of entRows) {
    appendEntitlement(entitlements, row);
  }

  return {
    ...customerRow,
    subscriptions: subRows.map((row) => ({
      planId: row.planId,
      status: row.status,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
    })),
    entitlements,
  };
}

export function getProviderCustomer(
  customerRow: Customer,
  providerId: string,
): ProviderCustomer | null {
  const providerMap = (customerRow.provider ?? {}) as ProviderCustomerMap;
  return providerMap[providerId] ?? null;
}

export async function setProviderCustomer(
  database: PayKitDatabase,
  input: { customerId: string; providerCustomer: ProviderCustomer; providerId: string },
): Promise<void> {
  const existingCustomer = await getCustomerByIdOrThrow(database, input.customerId);
  const providerMap = (existingCustomer.provider ?? {}) as ProviderCustomerMap;
  providerMap[input.providerId] = input.providerCustomer;

  await database
    .update(customer)
    .set({ provider: providerMap, updatedAt: new Date() })
    .where(eq(customer.id, input.customerId));
}

export function getProviderCustomerId(customerRow: Customer, providerId: string): string | null {
  return getProviderCustomer(customerRow, providerId)?.id ?? null;
}

export async function getProviderCustomerIdForCustomer(
  database: PayKitDatabase,
  input: { customerId: string; providerId: string },
): Promise<string | null> {
  const row = await database.query.customer.findFirst({
    where: eq(customer.id, input.customerId),
  });
  if (!row) return null;
  return getProviderCustomerId(row, input.providerId);
}

export async function findCustomerByProviderCustomerId(
  database: PayKitDatabase,
  input: { providerCustomerId: string; providerId: string },
): Promise<Customer | null> {
  return (
    (await database.query.customer.findFirst({
      where: sql`${customer.provider}->${input.providerId}->>'id' = ${input.providerCustomerId}`,
    })) ?? null
  );
}

function providerCustomerNeedsSync(
  existing: ProviderCustomer,
  customer: { email: string | null; name: string | null; metadata: Record<string, string> | null },
): boolean {
  if ((existing.syncedEmail ?? null) !== (customer.email ?? null)) return true;
  if ((existing.syncedName ?? null) !== (customer.name ?? null)) return true;
  const existingMeta = stableStringify(existing.syncedMetadata);
  const currentMeta = stableStringify(customer.metadata);
  return existingMeta !== currentMeta;
}

export async function upsertProviderCustomer(
  ctx: PayKitContext,
  input: { customerId: string; customerRow?: Customer },
): Promise<{ customerId: string; providerCustomer: ProviderCustomer; providerCustomerId: string }> {
  const providerId = ctx.provider.id;

  const existingCustomer =
    input.customerRow ?? (await getCustomerByIdOrThrow(ctx.database, input.customerId));
  const existingProviderCustomer = getProviderCustomer(existingCustomer, providerId);
  const existingProviderCustomerId = existingProviderCustomer?.id ?? null;

  if (
    existingProviderCustomerId &&
    !providerCustomerNeedsSync(existingProviderCustomer!, existingCustomer)
  ) {
    return {
      customerId: input.customerId,
      providerCustomer: existingProviderCustomer as ProviderCustomer,
      providerCustomerId: existingProviderCustomerId,
    };
  }

  let providerCustomer: ProviderCustomer;

  if (existingProviderCustomerId) {
    await ctx.provider.updateCustomer({
      providerCustomerId: existingProviderCustomerId,
      email: existingCustomer.email ?? undefined,
      name: existingCustomer.name ?? undefined,
      metadata: existingCustomer.metadata ?? undefined,
    });
    providerCustomer = { ...existingProviderCustomer!, id: existingProviderCustomerId };
  } else {
    const result = await ctx.provider.createCustomer({
      createTestClock:
        ctx.options.testing?.enabled === true && ctx.provider.capabilities.testClocks,
      id: existingCustomer.id,
      email: existingCustomer.email ?? undefined,
      name: existingCustomer.name ?? undefined,
      metadata: existingCustomer.metadata ?? undefined,
    });
    providerCustomer = result.providerCustomer;
  }

  const enrichedProviderCustomer: ProviderCustomer = {
    ...providerCustomer,
    syncedEmail: existingCustomer.email,
    syncedName: existingCustomer.name,
    syncedMetadata: existingCustomer.metadata,
  };

  await setProviderCustomer(ctx.database, {
    customerId: input.customerId,
    providerCustomer: enrichedProviderCustomer,
    providerId,
  });

  return {
    customerId: input.customerId,
    providerCustomer: enrichedProviderCustomer,
    providerCustomerId: providerCustomer.id,
  };
}

export async function deleteCustomerFromDatabase(
  database: PayKitDatabase,
  customerId: string,
): Promise<void> {
  const subIds = await database
    .select({ id: subscription.id })
    .from(subscription)
    .where(eq(subscription.customerId, customerId));
  const sIds = subIds.map((row) => row.id);

  if (sIds.length > 0) {
    await database.delete(entitlement).where(inArray(entitlement.subscriptionId, sIds));
  }

  await database.delete(subscription).where(eq(subscription.customerId, customerId));
  await database.delete(invoice).where(eq(invoice.customerId, customerId));
  await database.delete(paymentMethod).where(eq(paymentMethod.customerId, customerId));
  await database.delete(customer).where(eq(customer.id, customerId));
}

export async function hardDeleteCustomer(ctx: PayKitContext, customerId: string): Promise<void> {
  const existingCustomer = await getCustomerByIdOrThrow(ctx.database, customerId);

  const providerCustomerId = getProviderCustomerId(existingCustomer, ctx.provider.id);
  if (providerCustomerId) {
    try {
      assertProviderHasCapability(ctx.provider, "listActiveSubscriptions");
      assertProviderHasCapability(ctx.provider, "cancelSubscriptionsAtPeriodEnd");
      const activeSubscriptions = await ctx.provider.listActiveSubscriptions({
        providerCustomerId,
      });
      for (const sub of activeSubscriptions) {
        await ctx.provider.cancelSubscriptionAtPeriodEnd({
          providerSubscriptionId: sub.providerSubscriptionId,
        });
      }
      await ctx.provider.deleteCustomer({ providerCustomerId });
    } catch (error) {
      ctx.logger.error({ providerCustomerId, err: error }, "failed to clean up provider customer");
    }
  }

  await deleteCustomerFromDatabase(ctx.database, customerId);
}

export async function emitCustomerUpdated(ctx: PayKitContext, customerId: string): Promise<void> {
  const subscriptions = await getCurrentSubscriptions(ctx.database, customerId);
  const payload = { customerId, subscriptions };

  try {
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
  } catch (error) {
    ctx.logger.error({ err: error }, "error in customer.updated event handler");
  }
}

export async function listCustomers(
  ctx: PayKitContext,
  input?: {
    limit?: number;
    offset?: number;
    planIds?: string[];
  },
): Promise<ListCustomersResult> {
  const limit = input?.limit ?? 50;
  const offset = input?.offset ?? 0;
  const planIds = input?.planIds;

  let customerRows: Customer[];
  let total: number;

  if (planIds && planIds.length > 0) {
    const planFilter = and(
      inArray(product.id, planIds),
      inArray(subscription.status, ["active", "trialing", "past_due"]),
      or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      isNull(customer.deletedAt),
    );

    const filteredResult = await ctx.database
      .selectDistinct({ customer })
      .from(customer)
      .innerJoin(subscription, eq(subscription.customerId, customer.id))
      .innerJoin(product, eq(product.internalId, subscription.productInternalId))
      .where(planFilter)
      .orderBy(desc(customer.createdAt))
      .limit(limit)
      .offset(offset);
    customerRows = filteredResult.map((r) => r.customer);

    const countResult = await ctx.database
      .select({ count: countDistinct(customer.id) })
      .from(customer)
      .innerJoin(subscription, eq(subscription.customerId, customer.id))
      .innerJoin(product, eq(product.internalId, subscription.productInternalId))
      .where(planFilter);
    total = countResult[0]?.count ?? 0;
  } else {
    const countResult = await ctx.database
      .select({ count: count() })
      .from(customer)
      .where(isNull(customer.deletedAt));
    total = countResult[0]?.count ?? 0;

    customerRows = await ctx.database.query.customer.findMany({
      where: isNull(customer.deletedAt),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit,
      offset,
    });
  }

  const customerIds = customerRows.map((c) => c.id);
  const data: CustomerWithDetails[] = [];

  if (customerIds.length > 0) {
    const subRows = await ctx.database
      .select({
        customerId: subscription.customerId,
        planId: product.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStartAt,
        currentPeriodEnd: subscription.currentPeriodEndAt,
      })
      .from(subscription)
      .innerJoin(product, eq(product.internalId, subscription.productInternalId))
      .where(
        and(
          inArray(subscription.customerId, customerIds),
          inArray(subscription.status, ["active", "trialing", "past_due", "scheduled"]),
          or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
        ),
      )
      .orderBy(desc(subscription.createdAt));

    const entRows = await ctx.database
      .select({
        customerId: entitlement.customerId,
        featureId: entitlement.featureId,
        balance: entitlement.balance,
        limit: entitlement.limit,
        nextResetAt: entitlement.nextResetAt,
      })
      .from(entitlement)
      .innerJoin(subscription, eq(subscription.id, entitlement.subscriptionId))
      .where(
        and(
          inArray(entitlement.customerId, customerIds),
          inArray(subscription.status, ["active", "trialing", "past_due"]),
          or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
        ),
      );

    const subscriptionsByCustomer = new Map<string, CustomerSubscription[]>();
    for (const row of subRows) {
      const list = subscriptionsByCustomer.get(row.customerId) ?? [];
      list.push({
        planId: row.planId,
        status: row.status,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        currentPeriodStart: row.currentPeriodStart,
        currentPeriodEnd: row.currentPeriodEnd,
      });
      subscriptionsByCustomer.set(row.customerId, list);
    }

    const entitlementsByCustomer = new Map<string, Record<string, CustomerEntitlement>>();
    for (const row of entRows) {
      const map = entitlementsByCustomer.get(row.customerId) ?? {};
      appendEntitlement(map, row);
      entitlementsByCustomer.set(row.customerId, map);
    }

    for (const c of customerRows) {
      data.push({
        ...c,
        subscriptions: subscriptionsByCustomer.get(c.id) ?? [],
        entitlements: entitlementsByCustomer.get(c.id) ?? {},
      });
    }
  }

  return {
    data,
    total,
    hasMore: offset + limit < total,
    limit,
    offset,
  };
}
