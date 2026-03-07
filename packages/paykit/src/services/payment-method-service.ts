import { and, desc, eq, isNull } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { generateId } from "../core/utils";
import { paymentMethod } from "../database/postgres/schema";
import type { NormalizedPaymentMethod } from "../types/events";
import type { InternalPaymentMethod, PaymentMethod } from "../types/models";
import {
  getCustomerById,
  getProviderCustomerByProviderCustomerId,
  upsertProviderCustomer,
} from "./customer-service";

export interface AttachPaymentMethodInput {
  providerId: string;
  customerId: string;
  returnURL: string;
}

export interface SetDefaultPaymentMethodInput {
  customerId: string;
  providerId: string;
  paymentMethodId: string;
}

export interface DetachPaymentMethodInput {
  customerId: string;
  providerId: string;
  id: string;
}

interface PaymentMethodLookupInput {
  includeDeleted?: boolean;
  providerId: string;
  providerMethodId: string;
}

async function getProvider(ctx: PayKitContext, providerId: string) {
  const provider = ctx.providers.get(providerId);
  if (!provider) {
    throw new PayKitError("PROVIDER_NOT_FOUND");
  }
  return provider;
}

async function ensureCustomer(ctx: PayKitContext, customerId: string): Promise<void> {
  const customer = await getCustomerById(ctx.database, customerId);
  if (!customer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }
}

export async function attachPaymentMethod(
  ctx: PayKitContext,
  input: AttachPaymentMethodInput,
): Promise<{ url: string }> {
  await ensureCustomer(ctx, input.customerId);
  const providerCustomer = await upsertProviderCustomer(ctx, {
    customerId: input.customerId,
    providerId: input.providerId,
  });
  const provider = await getProvider(ctx, input.providerId);
  return provider.attachPaymentMethod({
    providerCustomerId: providerCustomer.providerCustomerId,
    returnURL: input.returnURL,
  });
}

export async function listPaymentMethods(
  ctx: PayKitContext,
  input: { customerId: string; providerId: string },
): Promise<PaymentMethod[]> {
  await ensureCustomer(ctx, input.customerId);
  await getProvider(ctx, input.providerId);
  const methods = await ctx.database
    .select()
    .from(paymentMethod)
    .where(
      and(
        eq(paymentMethod.customerId, input.customerId),
        eq(paymentMethod.providerId, input.providerId),
        isNull(paymentMethod.deletedAt),
      ),
    )
    .orderBy(desc(paymentMethod.createdAt));

  return methods.map(toPublicPaymentMethod);
}

export async function setDefaultPaymentMethod(
  ctx: PayKitContext,
  input: SetDefaultPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);

  const methods = await ctx.database
    .select()
    .from(paymentMethod)
    .where(
      and(
        eq(paymentMethod.customerId, input.customerId),
        eq(paymentMethod.providerId, input.providerId),
        isNull(paymentMethod.deletedAt),
      ),
    );

  const exists = methods.some((method) => method.id === input.paymentMethodId);
  if (!exists) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  await ctx.database.transaction(async (tx) => {
    await tx
      .update(paymentMethod)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMethod.customerId, input.customerId),
          eq(paymentMethod.providerId, input.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      );

    await tx
      .update(paymentMethod)
      .set({
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMethod.id, input.paymentMethodId),
          eq(paymentMethod.customerId, input.customerId),
          eq(paymentMethod.providerId, input.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      );
  });
}

export async function detachPaymentMethod(
  ctx: PayKitContext,
  input: DetachPaymentMethodInput,
): Promise<void> {
  await ensureCustomer(ctx, input.customerId);
  const existingPaymentMethod = await ctx.database.query.paymentMethod.findFirst({
    where: and(
      eq(paymentMethod.id, input.id),
      eq(paymentMethod.customerId, input.customerId),
      eq(paymentMethod.providerId, input.providerId),
      isNull(paymentMethod.deletedAt),
    ),
  });
  if (!existingPaymentMethod) {
    throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
  }

  const provider = await getProvider(ctx, input.providerId);

  await provider.detachPaymentMethod({
    providerMethodId: existingPaymentMethod.providerMethodId,
  });

  await ctx.database
    .update(paymentMethod)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
    })
    .where(eq(paymentMethod.id, existingPaymentMethod.id));
}

export function toPublicPaymentMethod(method: InternalPaymentMethod): PaymentMethod {
  const { customerId: _customerId, ...publicMethod } = method;
  return publicMethod;
}

export async function getPaymentMethodByProviderMethodId(
  ctx: PayKitContext,
  input: PaymentMethodLookupInput,
): Promise<InternalPaymentMethod | null> {
  const deletedFilter = input.includeDeleted ? undefined : isNull(paymentMethod.deletedAt);

  return (
    (await ctx.database.query.paymentMethod.findFirst({
      where: deletedFilter
        ? and(
            eq(paymentMethod.providerId, input.providerId),
            eq(paymentMethod.providerMethodId, input.providerMethodId),
            deletedFilter,
          )
        : and(
            eq(paymentMethod.providerId, input.providerId),
            eq(paymentMethod.providerMethodId, input.providerMethodId),
          ),
    })) ?? null
  );
}

export async function upsertPaymentMethodFromWebhook(
  ctx: PayKitContext,
  input: {
    paymentMethod: NormalizedPaymentMethod;
    providerCustomerId: string;
    providerId: string;
  },
): Promise<InternalPaymentMethod> {
  return ctx.database.transaction(async (tx) => {
    const providerCustomer = await getProviderCustomerByProviderCustomerId(tx, {
      providerCustomerId: input.providerCustomerId,
      providerId: input.providerId,
    });
    if (!providerCustomer) {
      throw new PayKitError("PROVIDER_CUSTOMER_NOT_FOUND");
    }

    const existing = await tx.query.paymentMethod.findFirst({
      where: and(
        eq(paymentMethod.providerId, input.providerId),
        eq(paymentMethod.providerMethodId, input.paymentMethod.providerMethodId),
      ),
    });

    const now = new Date();

    await tx
      .update(paymentMethod)
      .set({
        isDefault: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentMethod.customerId, providerCustomer.customerId),
          eq(paymentMethod.providerId, input.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      );

    if (existing) {
      const rows = await tx
        .update(paymentMethod)
        .set({
          customerId: providerCustomer.customerId,
          deletedAt: null,
          expiryMonth: input.paymentMethod.expiryMonth ?? null,
          expiryYear: input.paymentMethod.expiryYear ?? null,
          isDefault: true,
          last4: input.paymentMethod.last4 ?? null,
          type: input.paymentMethod.type,
          updatedAt: now,
        })
        .where(eq(paymentMethod.id, existing.id))
        .returning();

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to update payment method.");
      }

      return row;
    }

    const rows = await tx
      .insert(paymentMethod)
      .values({
        createdAt: now,
        customerId: providerCustomer.customerId,
        deletedAt: null,
        expiryMonth: input.paymentMethod.expiryMonth ?? null,
        expiryYear: input.paymentMethod.expiryYear ?? null,
        id: generateId("pm"),
        isDefault: true,
        last4: input.paymentMethod.last4 ?? null,
        providerId: input.providerId,
        providerMethodId: input.paymentMethod.providerMethodId,
        type: input.paymentMethod.type,
        updatedAt: now,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create payment method.");
    }

    return row;
  });
}

export async function deletePaymentMethodFromWebhook(
  ctx: PayKitContext,
  input: { providerId: string; providerMethodId: string },
): Promise<InternalPaymentMethod | null> {
  return ctx.database.transaction(async (tx) => {
    const existing = await tx.query.paymentMethod.findFirst({
      where: and(
        eq(paymentMethod.providerId, input.providerId),
        eq(paymentMethod.providerMethodId, input.providerMethodId),
      ),
    });

    if (!existing) {
      return null;
    }

    const now = new Date();
    const rows = await tx
      .update(paymentMethod)
      .set({
        deletedAt: now,
        isDefault: false,
        updatedAt: now,
      })
      .where(eq(paymentMethod.id, existing.id))
      .returning();

    const deletedMethod = rows[0];
    if (!deletedMethod) {
      throw new Error("Failed to delete payment method.");
    }

    if (existing.isDefault) {
      const fallback = await tx.query.paymentMethod.findFirst({
        orderBy: desc(paymentMethod.createdAt),
        where: and(
          eq(paymentMethod.customerId, existing.customerId),
          eq(paymentMethod.providerId, existing.providerId),
          isNull(paymentMethod.deletedAt),
        ),
      });

      if (fallback) {
        await tx
          .update(paymentMethod)
          .set({
            isDefault: true,
            updatedAt: now,
          })
          .where(eq(paymentMethod.id, fallback.id));
      }
    }

    return deletedMethod;
  });
}
