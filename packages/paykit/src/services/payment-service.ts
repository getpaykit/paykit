import { and, eq } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { generateId } from "../core/utils";
import { payment } from "../database/postgres/schema";
import type { NormalizedPayment } from "../types/events";
import type { InternalPayment, Payment } from "../types/models";
import { getProviderCustomerByProviderCustomerId } from "./customer-service";
import { getPaymentMethodByProviderMethodId } from "./payment-method-service";

export async function getPaymentByProviderPaymentId(
  ctx: PayKitContext,
  input: { providerId: string; providerPaymentId: string },
): Promise<InternalPayment | null> {
  return (
    (await ctx.database.query.payment.findFirst({
      where: and(
        eq(payment.providerId, input.providerId),
        eq(payment.providerPaymentId, input.providerPaymentId),
      ),
    })) ?? null
  );
}

export async function upsertPaymentFromWebhook(
  ctx: PayKitContext,
  input: {
    payment: NormalizedPayment;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<InternalPayment> {
  return ctx.database.transaction(async (tx) => {
    const providerCustomer = await getProviderCustomerByProviderCustomerId(tx, {
      providerCustomerId: input.providerCustomerId,
      providerId: input.providerId,
    });
    if (!providerCustomer) {
      throw new PayKitError("PROVIDER_CUSTOMER_NOT_FOUND");
    }

    const linkedPaymentMethod = input.payment.providerMethodId
      ? await getPaymentMethodByProviderMethodId(
          {
            ...ctx,
            database: tx,
          },
          {
            providerId: input.providerId,
            providerMethodId: input.payment.providerMethodId,
          },
        )
      : null;

    const existing = await tx.query.payment.findFirst({
      where: and(
        eq(payment.providerId, input.providerId),
        eq(payment.providerPaymentId, input.payment.providerPaymentId),
      ),
    });

    const paymentMethodId = linkedPaymentMethod?.id ?? existing?.paymentMethodId ?? null;
    const metadata = input.payment.metadata ?? null;
    const now = new Date();

    if (existing) {
      const rows = await tx
        .update(payment)
        .set({
          amount: input.payment.amount,
          currency: input.payment.currency,
          description: input.payment.description ?? null,
          metadata,
          paymentMethodId,
          status: input.payment.status,
          updatedAt: now,
        })
        .where(eq(payment.id, existing.id))
        .returning();

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to update payment.");
      }

      return row;
    }

    const rows = await tx
      .insert(payment)
      .values({
        amount: input.payment.amount,
        createdAt: input.payment.createdAt,
        currency: input.payment.currency,
        customerId: providerCustomer.customerId,
        description: input.payment.description ?? null,
        id: generateId("pay"),
        metadata,
        paymentMethodId,
        providerId: input.providerId,
        providerPaymentId: input.payment.providerPaymentId,
        status: input.payment.status,
        updatedAt: now,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create payment.");
    }

    return row;
  });
}

export function toPublicPayment(record: InternalPayment): Payment {
  const { customerId: _customerId, ...publicPayment } = record;
  return publicPayment;
}
