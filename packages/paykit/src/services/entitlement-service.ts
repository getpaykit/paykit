import { sql } from "drizzle-orm";

import type { PayKitDatabase } from "../database";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface ActiveEntitlementRow {
  balance: number;
  id: string;
  nextResetAt: Date | null;
  originalLimit: number | null;
  resetInterval: string | null;
  unlimited: boolean;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function addResetInterval(date: Date, resetInterval: string): Date {
  const next = new Date(date);
  if (resetInterval === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (resetInterval === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (resetInterval === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  if (resetInterval === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function aggregateBalance(rows: ActiveEntitlementRow[]): EntitlementBalance | null {
  if (rows.length === 0) return null;

  const hasUnlimited = rows.some((row) => row.unlimited);
  if (hasUnlimited) {
    return { limit: 0, remaining: 0, resetAt: null, unlimited: true };
  }

  let remaining = 0;
  let limit = 0;
  let resetAt: Date | null = null;

  for (const row of rows) {
    remaining += row.balance;
    limit += row.originalLimit ?? 0;
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
  const result = (await db.execute(sql`
    SELECT
      ce.id,
      ce.unlimited,
      ce.balance,
      ce.next_reset_at AS "nextResetAt",
      pf."limit" AS "originalLimit",
      pf.reset_interval AS "resetInterval"
    FROM paykit_customer_entitlement ce
    INNER JOIN paykit_customer_product cp ON cp.id = ce.customer_product_id
    INNER JOIN paykit_product_feature pf
      ON pf.product_internal_id = cp.product_internal_id
      AND pf.feature_id = ce.feature_id
    WHERE ce.customer_id = ${customerId}
      AND ce.feature_id = ${featureId}
      AND cp.status IN ('active', 'trialing')
      AND (cp.ended_at IS NULL OR cp.ended_at > now())
  `)) as unknown as { rows: ActiveEntitlementRow[] };
  return result.rows;
}

/** Lazy-reset any stale entitlements and return the refreshed rows. */
async function resetStaleEntitlements(
  db: PayKitDatabase,
  rows: ActiveEntitlementRow[],
): Promise<ActiveEntitlementRow[]> {
  const now = new Date();
  let changed = false;

  for (const row of rows) {
    if (
      row.nextResetAt &&
      row.nextResetAt <= now &&
      row.resetInterval &&
      row.originalLimit != null
    ) {
      const nextReset = addResetInterval(now, row.resetInterval);
      await db.execute(sql`
        UPDATE paykit_customer_entitlement
        SET balance = ${row.originalLimit},
            next_reset_at = ${nextReset},
            updated_at = ${now}
        WHERE id = ${row.id}
          AND next_reset_at <= ${now}
      `);
      row.balance = row.originalLimit;
      row.nextResetAt = nextReset;
      changed = true;
    }
  }

  // If nothing changed, return as-is (avoid re-fetch)
  void changed;
  return rows;
}

// ---------------------------------------------------------------------------
// check — read entitlements with lazy reset
// ---------------------------------------------------------------------------

export async function checkEntitlement(
  database: PayKitDatabase,
  input: { customerId: string; featureId: string; required?: number },
): Promise<CheckResult> {
  const required = input.required ?? 1;

  const rows = await getActiveEntitlements(database, input.customerId, input.featureId);
  await resetStaleEntitlements(database, rows);

  const balance = aggregateBalance(rows);

  if (!balance) {
    return { allowed: false, balance: null };
  }

  if (balance.unlimited) {
    return { allowed: true, balance };
  }

  return { allowed: balance.remaining >= required, balance };
}

// ---------------------------------------------------------------------------
// report — lazy reset + atomic decrement
// ---------------------------------------------------------------------------

export async function reportEntitlement(
  database: PayKitDatabase,
  input: { amount?: number; customerId: string; featureId: string },
): Promise<ReportResult> {
  const amount = input.amount ?? 1;

  const rows = await getActiveEntitlements(database, input.customerId, input.featureId);
  await resetStaleEntitlements(database, rows);

  if (rows.length === 0) {
    return { balance: null, success: false };
  }

  const hasUnlimited = rows.some((row) => row.unlimited);
  if (hasUnlimited) {
    return { balance: aggregateBalance(rows), success: true };
  }

  // Find the first entitlement with sufficient balance and decrement atomically.
  // The WHERE balance >= $amount guard prevents over-decrementing under concurrency.
  let deducted = false;
  for (const row of rows) {
    if (row.unlimited || row.balance < amount) continue;

    const result = (await database.execute(sql`
      UPDATE paykit_customer_entitlement
      SET balance = balance - ${amount}, updated_at = ${new Date()}
      WHERE id = ${row.id}
        AND balance >= ${amount}
      RETURNING balance
    `)) as unknown as { rows: Array<{ balance: number }> };

    if (result.rows.length > 0) {
      row.balance = result.rows[0]!.balance;
      deducted = true;
      break;
    }
  }

  return { balance: aggregateBalance(rows), success: deducted };
}
