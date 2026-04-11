import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { PayKitDatabase } from "../database";
import { entitlement, productFeature, subscription } from "../database/schema";

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

function addResetInterval(date: Date, resetInterval: string): Date {
  const next = new Date(date);
  if (resetInterval === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (resetInterval === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (resetInterval === "month") {
    const day = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + 1);
    // Clamp: if day overflowed (e.g. Jan 31 → Mar 3), go to last day of target month
    if (next.getUTCDate() !== day) next.setUTCDate(0);
  }
  if (resetInterval === "year") {
    const day = next.getUTCDate();
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    if (next.getUTCDate() !== day) next.setUTCDate(0);
  }
  return next;
}

function getNextResetAt(currentResetAt: Date, now: Date, resetInterval: string): Date {
  let nextResetAt = new Date(currentResetAt);

  while (nextResetAt <= now) {
    nextResetAt = addResetInterval(nextResetAt, resetInterval);
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

const sortRowsForConsumption = (rows: ActiveEntitlementRow[]): ActiveEntitlementRow[] => {
  return [...rows].sort((left, right) => {
    if (left.nextResetAt && right.nextResetAt) {
      return left.nextResetAt.getTime() - right.nextResetAt.getTime();
    }

    if (left.nextResetAt) {
      return -1;
    }

    if (right.nextResetAt) {
      return 1;
    }

    return left.id.localeCompare(right.id);
  });
};

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

/** Lazy-reset any stale entitlements and return the refreshed rows. */
async function resetStaleEntitlements(
  db: PayKitDatabase,
  rows: ActiveEntitlementRow[],
  now: Date,
): Promise<ActiveEntitlementRow[]> {
  let changed = false;

  for (const row of rows) {
    if (
      row.nextResetAt &&
      row.nextResetAt <= now &&
      row.resetInterval &&
      row.originalLimit != null
    ) {
      const nextReset = getNextResetAt(row.nextResetAt, now, row.resetInterval);
      await db
        .update(entitlement)
        .set({
          balance: row.originalLimit,
          nextResetAt: nextReset,
          updatedAt: now,
        })
        .where(and(eq(entitlement.id, row.id), lte(entitlement.nextResetAt, now)));
      row.balance = row.originalLimit;
      row.nextResetAt = nextReset;
      changed = true;
    }
  }

  // If nothing changed, return as-is (avoid re-fetch)
  void changed;
  return rows;
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

// report — lazy reset + transactional multi-row decrement

const MAX_REPORT_RETRIES = 3;

export async function reportEntitlement(
  database: PayKitDatabase,
  input: { amount?: number; customerId: string; featureId: string; now?: Date },
): Promise<ReportResult> {
  const amount = input.amount ?? 1;

  for (let attempt = 0; attempt < MAX_REPORT_RETRIES; attempt++) {
    const rows = await getActiveEntitlements(database, input.customerId, input.featureId);
    await resetStaleEntitlements(database, rows, input.now ?? new Date());

    if (rows.length === 0) {
      return { balance: null, success: false };
    }

    const hasUnlimited = rows.some((row) => row.originalLimit === null);
    if (hasUnlimited) {
      return { balance: aggregateBalance(rows), success: true };
    }

    const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);
    if (totalBalance < amount) {
      return { balance: aggregateBalance(rows), success: false };
    }

    const result = await deductAcrossRows(database, rows, amount);
    if (result) return result;
  }

  // All retries exhausted due to concurrent modifications
  const rows = await getActiveEntitlements(database, input.customerId, input.featureId);
  return { balance: aggregateBalance(rows), success: false };
}

/** Deduct amount across sorted rows in a transaction. Returns null on conflict to signal retry. */
async function deductAcrossRows(
  database: PayKitDatabase,
  rows: ActiveEntitlementRow[],
  amount: number,
): Promise<ReportResult | null> {
  try {
    await database.transaction(async (tx) => {
      let remaining = amount;

      for (const row of sortRowsForConsumption(rows)) {
        if (remaining === 0) break;
        if (row.originalLimit === null || row.balance <= 0) continue;

        const deduction = Math.min(row.balance, remaining);
        const result = await tx
          .update(entitlement)
          .set({
            balance: sql`${entitlement.balance} - ${deduction}`,
            updatedAt: new Date(),
          })
          .where(and(eq(entitlement.id, row.id), sql`${entitlement.balance} >= ${deduction}`))
          .returning({ balance: entitlement.balance });

        if (result.length === 0) {
          throw new ConflictError();
        }

        row.balance = result[0]!.balance!;
        remaining -= deduction;
      }
    });
  } catch (error) {
    if (error instanceof ConflictError) return null;
    throw error;
  }

  return { balance: aggregateBalance(rows), success: true };
}

class ConflictError extends Error {}
