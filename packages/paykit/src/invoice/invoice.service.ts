import { eq } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { generateId } from "../core/utils";
import { findCustomerByProviderCustomerId } from "../customer/customer.service";
import type { PayKitDatabase } from "../database";
import { invoice, subscription } from "../database/schema";
import type { ProviderInvoice } from "../providers/provider";
import type { NormalizedInvoice, UpsertInvoiceAction } from "../types/events";
import type { StoredInvoice } from "../types/models";

export async function upsertInvoiceRecord(
  database: PayKitDatabase,
  input: {
    customerId: string;
    providerId: string;
    subscriptionId?: string | null;
    invoice: ProviderInvoice | NormalizedInvoice;
  },
): Promise<StoredInvoice> {
  const now = new Date();

  const values = {
    amount: input.invoice.totalAmount,
    currency: input.invoice.currency,
    customerId: input.customerId,
    description: null as string | null,
    hostedUrl: input.invoice.hostedUrl ?? null,
    periodEndAt: input.invoice.periodEndAt ?? null,
    periodStartAt: input.invoice.periodStartAt ?? null,
    stripeInvoiceId: input.invoice.providerInvoiceId,
    status: input.invoice.status ?? "open",
    subscriptionId: input.subscriptionId ?? null,
    type: "subscription" as string,
    updatedAt: now,
  };

  const rows = await database
    .insert(invoice)
    .values({
      ...values,
      id: generateId("inv"),
    })
    .onConflictDoUpdate({
      target: invoice.stripeInvoiceId,
      set: values,
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.INVOICE_UPSERT_FAILED);
  }
  return row;
}

export async function applyInvoiceWebhookAction(
  ctx: PayKitContext,
  action: UpsertInvoiceAction,
): Promise<string | null> {
  const customerRow = await findCustomerByProviderCustomerId(ctx.database, {
    providerCustomerId: action.data.providerCustomerId,
    providerId: ctx.provider.id,
  });
  if (!customerRow) {
    return null;
  }

  const subscriptionRecord = action.data.providerSubscriptionId
    ? await ctx.database.query.subscription.findFirst({
        where: eq(subscription.stripeSubscriptionId, action.data.providerSubscriptionId),
      })
    : null;

  await upsertInvoiceRecord(ctx.database, {
    customerId: customerRow.id,
    invoice: action.data.invoice,
    providerId: ctx.provider.id,
    subscriptionId: subscriptionRecord?.id ?? null,
  });
  return customerRow.id;
}
