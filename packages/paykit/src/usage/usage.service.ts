import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { PayKitDatabase } from "../database";
import { customer, product, subscription } from "../database/schema";

async function getActiveMeteredLinkForFeature(
  database: PayKitDatabase,
  input: { customerId: string; featureId: string },
): Promise<{ providerCustomerId: string } | null> {
  const rows = await database
    .select({ stripeCustomerId: customer.stripeCustomerId })
    .from(subscription)
    .innerJoin(product, eq(product.internalId, subscription.productInternalId))
    .innerJoin(customer, eq(customer.id, subscription.customerId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.meteredFeatureId, input.featureId),
        inArray(subscription.status, ["active", "trialing", "past_due"]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row?.stripeCustomerId) {
    return null;
  }

  return { providerCustomerId: row.stripeCustomerId };
}

/**
 * Reports a Stripe usage-based billing event for a customer's active metered plan.
 * Unlike the local entitlement `report()`, this call's entire purpose is the billing
 * side effect, so failures rethrow rather than being swallowed. Callers wanting
 * at-least-once safety should pass a stable `eventId`, forwarded as Stripe's `identifier`.
 */
export async function reportUsageToProvider(
  ctx: PayKitContext,
  input: {
    customerId: string;
    featureId: string;
    quantity?: number;
    eventId?: string;
    timestamp?: Date;
  },
): Promise<{ success: true; providerEventId: string }> {
  const link = await getActiveMeteredLinkForFeature(ctx.database, {
    customerId: input.customerId,
    featureId: input.featureId,
  });
  if (!link) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.USAGE_NOT_METERED_FOR_CUSTOMER);
  }

  const { providerEventId } = await ctx.provider.reportUsageEvent({
    identifier: input.eventId,
    meterEventName: input.featureId,
    providerCustomerId: link.providerCustomerId,
    timestamp: input.timestamp,
    value: input.quantity ?? 1,
  });

  return { providerEventId, success: true };
}
