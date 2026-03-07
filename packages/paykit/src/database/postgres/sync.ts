import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { schema } from "./schema";

export async function syncPostgresSchema(db: NodePgDatabase<typeof schema>): Promise<void> {
  await db.execute(sql`
    create table if not exists paykit_customer (
      id text primary key,
      email text,
      name text,
      metadata jsonb,
      deleted_at timestamp,
      created_at timestamp not null,
      updated_at timestamp not null
    );
    create index if not exists paykit_customer_deleted_at_idx
    on paykit_customer (deleted_at);
    create table if not exists paykit_provider_customer (
      id text primary key,
      customer_id text not null references paykit_customer(id),
      provider_id text not null,
      provider_customer_id text not null,
      created_at timestamp not null
    );
    create unique index if not exists paykit_provider_customer_customer_provider_unique
    on paykit_provider_customer (customer_id, provider_id);
    create unique index if not exists paykit_provider_customer_provider_customer_unique
    on paykit_provider_customer (provider_id, provider_customer_id);
    create table if not exists paykit_payment_method (
      id text primary key,
      customer_id text not null references paykit_customer(id),
      provider_id text not null,
      provider_method_id text not null,
      type text not null,
      last4 text,
      expiry_month integer,
      expiry_year integer,
      is_default boolean not null default false,
      deleted_at timestamp,
      created_at timestamp not null,
      updated_at timestamp not null
    );
    create unique index if not exists paykit_payment_method_provider_unique
    on paykit_payment_method (provider_id, provider_method_id);
    create index if not exists paykit_payment_method_customer_provider_idx
    on paykit_payment_method (customer_id, provider_id, deleted_at);
    create table if not exists paykit_payment (
      id text primary key,
      customer_id text not null references paykit_customer(id),
      payment_method_id text references paykit_payment_method(id),
      provider_id text not null,
      provider_payment_id text not null,
      status text not null,
      amount integer not null,
      currency text not null,
      description text,
      metadata jsonb,
      created_at timestamp not null,
      updated_at timestamp not null
    );
    create unique index if not exists paykit_payment_provider_unique
    on paykit_payment (provider_id, provider_payment_id);
    create index if not exists paykit_payment_customer_provider_idx
    on paykit_payment (customer_id, provider_id)
  `);

  try {
    await db.execute(sql`
      alter table paykit_customer
      alter column reference_id drop not null
    `);
  } catch {
    // Ignore fresh schemas without the legacy column and parsers that do not support this DDL.
  }
}
