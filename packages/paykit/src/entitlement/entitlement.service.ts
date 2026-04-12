import { type SQL, and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { PayKitDatabase } from "../database";
import { entitlement, productFeature, subscription } from "../database/schema";
import { addInterval, getSecondInterval } from "../types/interval";

export interface EntitlementBalance {
  limit: number;
  remaining: number;
  resetAt: Date | null;
  unlimited: boolean;
}

export interface CheckResult {
  allowed: boolean;
  balance: EntitlementBalance | null;
}

export interface ReportResult {
  balance: EntitlementBalance | null;
  success: boolean;
}

interface ActiveEntitlementRow {
  balance: number;
  id: string;
  nextResetAt: Date | null;
  originalLimit: number | null;
  resetInterval: string | null;
}

function getNextResetAt(currentResetAt: Date, now: Date, resetInterval: string): Date {
  const secondInterval = getSecondInterval(resetInterval);
  if (secondInterval !== null) {
    const elapsedMs = now.getTime() - currentResetAt.getTime();
    const missedIntervals = Math.max(0, Math.ceil(elapsedMs / (secondInterval * 1000)));
    return addInterval(currentResetAt, missedIntervals * secondInterval);
  }

  let nextResetAt = new Date(currentResetAt);

  while (nextResetAt <= now) {
    nextResetAt = addInterval(nextResetAt, resetInterval);
  }

  return nextResetAt;
}

function aggregateBalance(rows: ActiveEntitlementRow[]): EntitlementBalance | null {
  if (rows.length === 0) return null;

  const hasUnlimited = rows.some((row) => row.originalLimit === null);
  if (hasUnlimited) {
    return { limit: 0, remaining: 0, resetAt: null, unlimited: true };
  }

  let remaining = 0;
  let limit = 0;
  let resetAt: Date | null = null;

  for (const row of rows) {
    remaining += row.balance;
    limit += row.originalLimit!;
    if (row.nextResetAt) {
      if (!resetAt || row.nextResetAt < resetAt) {
        resetAt = row.nextResetAt;
      }
    }
  }

  return { limit, remaining, resetAt, unlimited: false };
}

/** Fetch all active entitlements for a customer+feature, with product feature metadata. */
async function getActiveEntitlements(
  db: PayKitDatabase,
  customerId: string,
  featureId: string,
): Promise<ActiveEntitlementRow[]> {
  const rows = await db
    .select({
      id: entitlement.id,
      balance: entitlement.balance,
      nextResetAt: entitlement.nextResetAt,
      originalLimit: productFeature.limit,
      resetInterval: productFeature.resetInterval,
    })
    .from(entitlement)
    .innerJoin(subscription, eq(entitlement.subscriptionId, subscription.id))
    .innerJoin(
      productFeature,
      and(
        eq(productFeature.productInternalId, subscription.productInternalId),
        eq(productFeature.featureId, entitlement.featureId),
      ),
    )
    .where(
      and(
        eq(entitlement.customerId, customerId),
        eq(entitlement.featureId, featureId),
        inArray(subscription.status, ["active", "trialing"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    );
  return rows as ActiveEntitlementRow[];
}

/** Lazy-reset any stale entitlements in a single batch UPDATE. */
async function resetStaleEntitlements(
  db: PayKitDatabase,
  rows: ActiveEntitlementRow[],
  now: Date,
): Promise<void> {
  const staleRows = rows.filter(
    (row) =>
      row.nextResetAt && row.nextResetAt <= now && row.resetInterval && row.originalLimit != null,
  );
  if (staleRows.length === 0) return;

  const ids: string[] = [];
  const balanceChunks: SQL[] = [sql`(case`];
  const resetAtChunks: SQL[] = [sql`(case`];

  for (const row of staleRows) {
    const nextReset = getNextResetAt(row.nextResetAt!, now, row.resetInterval!);
    balanceChunks.push(sql`when ${entitlement.id} = ${row.id} then ${row.originalLimit}`);
    resetAtChunks.push(sql`when ${entitlement.id} = ${row.id} then ${nextReset}`);
    ids.push(row.id);
    row.balance = row.originalLimit!;
    row.nextResetAt = nextReset;
  }

  balanceChunks.push(sql`end)::integer`);
  resetAtChunks.push(sql`end)::timestamp`);

  await db
    .update(entitlement)
    .set({
      balance: sql.join(balanceChunks, sql.raw(" ")),
      nextResetAt: sql.join(resetAtChunks, sql.raw(" ")),
      updatedAt: now,
    })
    .where(and(inArray(entitlement.id, ids), lte(entitlement.nextResetAt, now)));
}

// check — read entitlements with lazy reset

export async function checkEntitlement(
  database: PayKitDatabase,
  input: { customerId: string; featureId: string; now?: Date; required?: number },
): Promise<CheckResult> {
  const required = input.required ?? 1;

  const rows = await getActiveEntitlements(database, input.customerId, input.featureId);
  await resetStaleEntitlements(database, rows, input.now ?? new Date());

  const balance = aggregateBalance(rows);

  if (!balance) {
    return { allowed: false, balance: null };
  }

  if (balance.unlimited) {
    return { allowed: true, balance };
  }

  return { allowed: balance.remaining >= required, balance };
}

// report — single CTE query for all common cases

type ReportQueryRow = Record<string, unknown> & {
  hasUnlimited: boolean;
  totalBalance: number;
  totalLimit: number;
  rowCount: number;
  earliestResetAt: Date | null;
  deductedId: string | null;
  newBalance: number | null;
};

export async function reportEntitlement(
  database: PayKitDatabase,
  input: { amount?: number; customerId: string; featureId: string; now?: Date },
): Promise<ReportResult> {
  const amount = input.amount ?? 1;
  const now = input.now ?? new Date();

  // Single CTE: read active rows with lazy-reset balances, try deducting from one
  const e = entitlement;
  const s = subscription;
  const result = await database.execute<ReportQueryRow>(sql`
    with active as (
      select ${e.id} as id,
             case when ${e.nextResetAt} <= ${now} and ${e.limit} is not null
               then ${e.limit} else ${e.balance} end as balance,
             ${e.limit} as "limit",
             ${e.nextResetAt} as next_reset_at
      from ${e}
      inner join ${s} on ${e.subscriptionId} = ${s.id}
      where ${e.customerId} = ${input.customerId}
        and ${e.featureId} = ${input.featureId}
        and ${s.status} in ('active', 'trialing')
        and (${s.endedAt} is null or ${s.endedAt} > now())
    ),
    deducted as (
      update ${e}
      set "balance" = ${e.balance} - ${amount},
          "updated_at" = ${now}
      where ${e.id} = (
        select id from active
        where balance >= ${amount} and "limit" is not null
        limit 1
      )
      and ${e.balance} >= ${amount}
      and not exists (select 1 from active where "limit" is null)
      returning ${e.id} as id, ${e.balance} as balance
    )
    select
      coalesce(bool_or(active."limit" is null), false) as "hasUnlimited",
      coalesce(sum(active.balance)::integer, 0) as "totalBalance",
      coalesce(sum(active."limit")::integer, 0) as "totalLimit",
      count(active.*)::integer as "rowCount",
      min(active.next_reset_at) as "earliestResetAt",
      d.id as "deductedId",
      d.balance as "newBalance"
    from active
    left join deducted d on true
    group by d.id, d.balance
  `);

  const row = result.rows[0];
  if (!row || row.rowCount === 0) {
    return { balance: null, success: false };
  }

  if (row.hasUnlimited) {
    return {
      balance: { limit: 0, remaining: 0, resetAt: null, unlimited: true },
      success: true,
    };
  }

  // Fast path succeeded — single row had enough balance
  if (row.deductedId) {
    const remaining = row.totalBalance - amount;
    return {
      balance: {
        limit: row.totalLimit,
        remaining,
        resetAt: row.earliestResetAt,
        unlimited: false,
      },
      success: true,
    };
  }

  const balance: EntitlementBalance = {
    limit: row.totalLimit,
    remaining: row.totalBalance,
    resetAt: row.earliestResetAt,
    unlimited: false,
  };

  if (row.totalBalance < amount) {
    return { balance, success: false };
  }

  // Stacked case: total is enough but no single row covers it — fall back
  return reportEntitlementStacked(database, input.customerId, input.featureId, amount, now);
}

/** Fallback for stacked rows where no single row covers the amount. */
async function reportEntitlementStacked(
  database: PayKitDatabase,
  customerId: string,
  featureId: string,
  amount: number,
  now: Date,
): Promise<ReportResult> {
  return database.transaction(async (tx) => {
    // Lock rows with FOR UPDATE to prevent concurrent stacked deductions
    const rows = (await tx
      .select({
        id: entitlement.id,
        balance: entitlement.balance,
        nextResetAt: entitlement.nextResetAt,
        originalLimit: productFeature.limit,
        resetInterval: productFeature.resetInterval,
      })
      .from(entitlement)
      .innerJoin(subscription, eq(entitlement.subscriptionId, subscription.id))
      .innerJoin(
        productFeature,
        and(
          eq(productFeature.productInternalId, subscription.productInternalId),
          eq(productFeature.featureId, entitlement.featureId),
        ),
      )
      .where(
        and(
          eq(entitlement.customerId, customerId),
          eq(entitlement.featureId, featureId),
          inArray(subscription.status, ["active", "trialing"]),
          or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
        ),
      )
      .for("update", { of: entitlement })) as ActiveEntitlementRow[];

    await resetStaleEntitlements(tx, rows, now);

    const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
    if (totalBalance < amount) {
      return { balance: aggregateBalance(rows), success: false };
    }

    // Compute per-row target balances: greedily deduct from each row
    const ids: string[] = [];
    const chunks: SQL[] = [sql`(case`];
    let remaining = amount;

    for (const row of rows) {
      if (row.originalLimit === null || row.balance <= 0) continue;
      const deduction = Math.min(row.balance, remaining);
      const target = row.balance - deduction;
      chunks.push(sql`when ${entitlement.id} = ${row.id} then ${target}`);
      ids.push(row.id);
      row.balance = target;
      remaining -= deduction;
    }

    chunks.push(sql`end)::integer`);

    await tx
      .update(entitlement)
      .set({ balance: sql.join(chunks, sql.raw(" ")), updatedAt: now })
      .where(inArray(entitlement.id, ids));

    return { balance: aggregateBalance(rows), success: true };
  });
}
