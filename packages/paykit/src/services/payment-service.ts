import { and, eq } from "drizzle-orm";

import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { payment, paymentMethod, providerCustomer } from "../database/schema";
import type { NormalizedPayment } from "../types/events";

export async function syncPaymentByProviderCustomer(
  database: PayKitDatabase,
  input: {
    payment: NormalizedPayment;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<void> {
  const customerMapping = await database.query.providerCustomer.findFirst({
    where: and(
      eq(providerCustomer.providerCustomerId, input.providerCustomerId),
      eq(providerCustomer.providerId, input.providerId),
    ),
  });
  if (!customerMapping) {
    return;
  }

  const existingPayment = await database.query.payment.findFirst({
    where: and(
      eq(payment.providerId, input.providerId),
      eq(payment.providerPaymentId, input.payment.providerPaymentId),
    ),
  });

  const existingMethod = input.payment.providerMethodId
    ? await database.query.paymentMethod.findFirst({
        where: and(
          eq(paymentMethod.providerId, input.providerId),
          eq(paymentMethod.providerMethodId, input.payment.providerMethodId),
        ),
      })
    : null;

  const values = {
    amount: input.payment.amount,
    currency: input.payment.currency,
    customerId: customerMapping.customerId,
    description: input.payment.description ?? null,
    metadata: input.payment.metadata ?? null,
    paymentMethodId: existingMethod?.id ?? null,
    providerId: input.providerId,
    providerPaymentId: input.payment.providerPaymentId,
    status: input.payment.status,
    updatedAt: new Date(),
  };

  if (existingPayment) {
    await database.update(payment).set(values).where(eq(payment.id, existingPayment.id));
    return;
  }

  await database.insert(payment).values({
    ...values,
    createdAt: input.payment.createdAt,
    id: generateId("pay"),
  });
}
