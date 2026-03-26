import { and, eq, isNull } from "drizzle-orm";

import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { paymentMethod, providerCustomer } from "../database/schema";
import type { NormalizedPaymentMethod } from "../types/events";

export async function getDefaultPaymentMethod(
  database: PayKitDatabase,
  input: { customerId: string; providerId: string },
) {
  return (
    (await database.query.paymentMethod.findFirst({
      orderBy(fields, operators) {
        return [operators.desc(fields.isDefault), operators.desc(fields.createdAt)];
      },
      where: and(
        eq(paymentMethod.customerId, input.customerId),
        eq(paymentMethod.providerId, input.providerId),
        isNull(paymentMethod.deletedAt),
      ),
    })) ?? null
  );
}

export async function syncPaymentMethodByProviderCustomer(
  database: PayKitDatabase,
  input: {
    paymentMethod: NormalizedPaymentMethod;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<void> {
  const mapping = await database.query.providerCustomer.findFirst({
    where: and(
      eq(providerCustomer.providerCustomerId, input.providerCustomerId),
      eq(providerCustomer.providerId, input.providerId),
    ),
  });
  if (!mapping) {
    return;
  }

  const now = new Date();
  const existing = await database.query.paymentMethod.findFirst({
    where: and(
      eq(paymentMethod.providerId, input.providerId),
      eq(paymentMethod.providerMethodId, input.paymentMethod.providerMethodId),
    ),
  });

  if (input.paymentMethod.isDefault) {
    await database
      .update(paymentMethod)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(paymentMethod.customerId, mapping.customerId),
          eq(paymentMethod.providerId, input.providerId),
        ),
      );
  }

  if (existing) {
    await database
      .update(paymentMethod)
      .set({
        customerId: mapping.customerId,
        deletedAt: null,
        expiryMonth: input.paymentMethod.expiryMonth ?? null,
        expiryYear: input.paymentMethod.expiryYear ?? null,
        isDefault: input.paymentMethod.isDefault ?? existing.isDefault,
        last4: input.paymentMethod.last4 ?? null,
        type: input.paymentMethod.type,
        updatedAt: now,
      })
      .where(eq(paymentMethod.id, existing.id));
    return;
  }

  await database.insert(paymentMethod).values({
    createdAt: now,
    customerId: mapping.customerId,
    deletedAt: null,
    expiryMonth: input.paymentMethod.expiryMonth ?? null,
    expiryYear: input.paymentMethod.expiryYear ?? null,
    id: generateId("pm"),
    isDefault: input.paymentMethod.isDefault ?? false,
    last4: input.paymentMethod.last4 ?? null,
    providerId: input.providerId,
    providerMethodId: input.paymentMethod.providerMethodId,
    type: input.paymentMethod.type,
    updatedAt: now,
  });
}

export async function deletePaymentMethodByProviderId(
  database: PayKitDatabase,
  input: {
    providerId: string;
    providerMethodId: string;
  },
): Promise<void> {
  await database
    .update(paymentMethod)
    .set({
      deletedAt: new Date(),
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentMethod.providerId, input.providerId),
        eq(paymentMethod.providerMethodId, input.providerMethodId),
      ),
    );
}
