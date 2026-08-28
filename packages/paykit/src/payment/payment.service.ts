import type { PayKitContext } from "../core/context";
import { generateId } from "../core/utils";
import { findCustomerByProviderCustomerId } from "../customer/customer.service";
import type { PayKitDatabase } from "../database";
import { invoice } from "../database/schema";
import type { NormalizedPayment, UpsertPaymentAction } from "../types/events";

export async function syncPaymentByProviderCustomer(
  database: PayKitDatabase,
  input: {
    payment: NormalizedPayment;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<string | null> {
  const customerRow = await findCustomerByProviderCustomerId(database, {
    providerCustomerId: input.providerCustomerId,
    providerId: input.providerId,
  });
  if (!customerRow) {
    return null;
  }

  const values = {
    customerId: customerRow.id,
    type: "charge",
    status: input.payment.status,
    amount: input.payment.amount,
    currency: input.payment.currency,
    description: input.payment.description ?? null,
    stripePaymentId: input.payment.providerPaymentId,
    stripePaymentMethodId: input.payment.providerMethodId ?? null,
    updatedAt: new Date(),
  };

  await database
    .insert(invoice)
    .values({ id: generateId("inv"), ...values })
    .onConflictDoUpdate({ target: invoice.stripePaymentId, set: values });

  return customerRow.id;
}

export async function applyPaymentWebhookAction(
  ctx: PayKitContext,
  action: UpsertPaymentAction,
): Promise<string | null> {
  return syncPaymentByProviderCustomer(ctx.database, {
    payment: action.data.payment,
    providerCustomerId: action.data.providerCustomerId,
    providerId: ctx.provider.id,
  });
}
