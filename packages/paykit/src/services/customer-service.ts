import { and, eq, isNull } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import { generateId } from "../core/utils";
import type { PayKitDatabase } from "../database";
import { customer, providerCustomer } from "../database/postgres/schema";
import type { Customer, InternalProviderCustomer } from "../types/models";

function anonymizedEmail(id: string): string {
  return `deleted+${id}@paykit.local`;
}

export interface SyncCustomerInput {
  id: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export async function syncCustomer(
  database: PayKitDatabase,
  input: SyncCustomerInput,
): Promise<Customer> {
  const now = new Date();
  const existing = await database.query.customer.findFirst({
    where: eq(customer.id, input.id),
  });

  if (existing) {
    const rows = await database
      .update(customer)
      .set({
        email: input.email ?? existing.email ?? null,
        name: input.name ?? existing.name ?? null,
        metadata: input.metadata ?? existing.metadata ?? null,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(customer.id, existing.id))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to update customer.");
    }
    return row;
  }

  const rows = await database
    .insert(customer)
    .values({
      id: input.id,
      email: input.email ?? null,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create customer.");
  }
  return row;
}

export async function getCustomerById(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer | null> {
  return (
    (await database.query.customer.findFirst({
      where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
    })) ?? null
  );
}

export async function getCustomerByIdOrThrow(
  database: PayKitDatabase,
  customerId: string,
): Promise<Customer> {
  const existingCustomer = await getCustomerById(database, customerId);
  if (!existingCustomer) {
    throw new PayKitError("CUSTOMER_NOT_FOUND");
  }

  return existingCustomer;
}

export async function getProviderCustomer(
  database: PayKitDatabase,
  input: { customerId: string; providerId: string },
): Promise<InternalProviderCustomer | null> {
  return (
    (await database.query.providerCustomer.findFirst({
      where: and(
        eq(providerCustomer.customerId, input.customerId),
        eq(providerCustomer.providerId, input.providerId),
      ),
    })) ?? null
  );
}

export async function getProviderCustomerByProviderCustomerId(
  database: PayKitDatabase,
  input: { providerCustomerId: string; providerId: string },
): Promise<InternalProviderCustomer | null> {
  return (
    (await database.query.providerCustomer.findFirst({
      where: and(
        eq(providerCustomer.providerId, input.providerId),
        eq(providerCustomer.providerCustomerId, input.providerCustomerId),
      ),
    })) ?? null
  );
}

export async function upsertProviderCustomer<TProviderId extends string>(
  ctx: PayKitContext<TProviderId>,
  input: { customerId: string; providerId: TProviderId },
): Promise<InternalProviderCustomer> {
  return ctx.database.transaction(async (tx) => {
    const customer = await getCustomerByIdOrThrow(tx, input.customerId);

    const existing = await getProviderCustomer(tx, input);
    if (existing) {
      return existing;
    }

    const provider = ctx.providers.get(input.providerId);
    if (!provider) {
      throw new PayKitError("PROVIDER_NOT_FOUND");
    }

    const { providerCustomerId } = await provider.upsertCustomer({
      id: customer.id,
      email: customer.email ?? undefined,
      name: customer.name ?? undefined,
      metadata: customer.metadata ?? undefined,
    });

    const rows = await tx
      .insert(providerCustomer)
      .values({
        id: generateId("pa"),
        customerId: customer.id,
        providerId: input.providerId,
        providerCustomerId,
        createdAt: new Date(),
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create provider customer.");
    }
    return row;
  });
}

export async function deleteCustomerById(
  database: PayKitDatabase,
  customerId: string,
): Promise<void> {
  const existingCustomer = await getCustomerByIdOrThrow(database, customerId);

  await database
    .update(customer)
    .set({
      email: anonymizedEmail(existingCustomer.id),
      name: "Deleted Customer",
      metadata: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customer.id, existingCustomer.id));
}
