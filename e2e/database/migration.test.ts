import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabase,
  getPendingMigrationCount,
  migrateDatabase,
} from "../../packages/paykit/src/database/index";
import { upsertInvoiceRecord } from "../../packages/paykit/src/invoice/invoice.service";
import { syncPaymentMethodByProviderCustomer } from "../../packages/paykit/src/payment-method/payment-method.service";
import { syncPaymentByProviderCustomer } from "../../packages/paykit/src/payment/payment.service";
import { env } from "../test-utils/env";

const migrationsFolder = fileURLToPath(
  new URL("../../packages/paykit/src/database/migrations", import.meta.url),
);
const dbName = `paykit_migration_test_${randomUUID().replaceAll("-", "")}`;
const adminUrl = env.TEST_DATABASE_URL;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${dbName}`;

describe("PayKit database upgrade", () => {
  let admin: Pool;
  let database: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl });
    await admin.query(`CREATE DATABASE "${dbName}"`);
    database = new Pool({ connectionString: databaseUrl.toString() });

    const migrations = readMigrationFiles({ migrationsFolder }).slice(0, 3);
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      for (const migration of migrations) {
        for (const statement of migration.sql) {
          await client.query(statement);
        }
      }
      await client.query(`
        CREATE TABLE public.paykit_migrations (
          id serial PRIMARY KEY, hash text NOT NULL, created_at bigint
        )
      `);
      for (const migration of migrations) {
        await client.query(
          "INSERT INTO public.paykit_migrations (hash, created_at) VALUES ($1, $2)",
          [migration.hash, migration.folderMillis],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await database.query(
      `INSERT INTO paykit_customer (id, email, stripe_customer_id, created_at, updated_at)
       VALUES ('customer_migration', 'test@example.com', 'cus_migration', now(), now())`,
    );
    await database.query(`
      INSERT INTO paykit_invoice
        (id, customer_id, type, status, amount, currency, stripe_invoice_id, stripe_payment_id, created_at, updated_at)
      VALUES
        ('invoice_old', 'customer_migration', 'subscription', 'open', 100, 'usd', 'in_duplicate', NULL, '2024-01-01', '2024-01-01'),
        ('invoice_new', 'customer_migration', 'subscription', 'paid', 100, 'usd', 'in_duplicate', NULL, '2024-02-01', '2024-02-01'),
        ('payment_old', 'customer_migration', 'charge', 'open', 100, 'usd', NULL, 'ch_duplicate', '2024-01-01', '2024-01-01'),
        ('payment_new', 'customer_migration', 'charge', 'paid', 100, 'usd', NULL, 'ch_duplicate', '2024-02-01', '2024-02-01'),
        ('null_invoice_a', 'customer_migration', 'charge', 'paid', 100, 'usd', NULL, NULL, '2024-01-01', '2024-01-01'),
        ('null_invoice_b', 'customer_migration', 'charge', 'paid', 100, 'usd', NULL, NULL, '2024-01-01', '2024-01-01')
    `);
    await database.query(`
      INSERT INTO paykit_payment_method
        (id, customer_id, stripe_payment_method_id, created_at, updated_at)
      VALUES
        ('method_old', 'customer_migration', 'pm_duplicate', '2024-01-01', '2024-01-01'),
        ('method_new', 'customer_migration', 'pm_duplicate', '2024-02-01', '2024-02-01'),
        ('null_method_a', 'customer_migration', NULL, '2024-01-01', '2024-01-01'),
        ('null_method_b', 'customer_migration', NULL, '2024-01-01', '2024-01-01')
    `);
  });

  afterAll(async () => {
    await database?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await admin.end();
    }
  });

  it("upgrades existing duplicate data through the production migrator", async () => {
    expect(await getPendingMigrationCount(database)).toBe(1);

    await migrateDatabase(database);

    expect(await getPendingMigrationCount(database)).toBe(0);
    const invoices = await database.query<{ id: string }>(
      "SELECT id FROM paykit_invoice ORDER BY id",
    );
    expect(invoices.rows.map((row) => row.id)).toEqual([
      "invoice_new",
      "null_invoice_a",
      "null_invoice_b",
      "payment_new",
    ]);
    const methods = await database.query<{ id: string }>(
      "SELECT id FROM paykit_payment_method ORDER BY id",
    );
    expect(methods.rows.map((row) => row.id)).toEqual([
      "method_new",
      "null_method_a",
      "null_method_b",
    ]);

    await expect(
      database.query(`
        INSERT INTO paykit_invoice
          (id, customer_id, type, status, amount, currency, stripe_invoice_id, created_at, updated_at)
        VALUES ('invoice_conflict', 'customer_migration', 'subscription', 'open', 100, 'usd', 'in_duplicate', now(), now())
      `),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      database.query(`
        INSERT INTO paykit_invoice
          (id, customer_id, type, status, amount, currency, stripe_payment_id, created_at, updated_at)
        VALUES ('payment_conflict', 'customer_migration', 'charge', 'open', 100, 'usd', 'ch_duplicate', now(), now())
      `),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      database.query(`
        INSERT INTO paykit_payment_method
          (id, customer_id, stripe_payment_method_id, created_at, updated_at)
        VALUES ('method_conflict', 'customer_migration', 'pm_duplicate', now(), now())
      `),
    ).rejects.toMatchObject({ code: "23505" });

    await migrateDatabase(database);
    expect(await getPendingMigrationCount(database)).toBe(0);
  });

  it("atomically upserts concurrent Stripe billing events", async () => {
    const db = await createDatabase(database);
    await Promise.all(
      Array.from({ length: 8 }, () =>
        upsertInvoiceRecord(db, {
          customerId: "customer_migration",
          providerId: "stripe",
          invoice: {
            currency: "usd",
            providerInvoiceId: "in_concurrent",
            status: "paid",
            totalAmount: 100,
          },
        }),
      ),
    );
    await Promise.all(
      Array.from({ length: 8 }, () =>
        syncPaymentByProviderCustomer(db, {
          providerId: "stripe",
          providerCustomerId: "cus_migration",
          payment: {
            amount: 100,
            createdAt: new Date(),
            currency: "usd",
            providerPaymentId: "ch_concurrent",
            status: "paid",
          },
        }),
      ),
    );
    await Promise.all(
      Array.from({ length: 8 }, () =>
        syncPaymentMethodByProviderCustomer(db, {
          providerId: "stripe",
          providerCustomerId: "cus_migration",
          paymentMethod: {
            isDefault: true,
            providerMethodId: "pm_concurrent",
            type: "card",
          },
        }),
      ),
    );

    for (const [table, column, id] of [
      ["paykit_invoice", "stripe_invoice_id", "in_concurrent"],
      ["paykit_invoice", "stripe_payment_id", "ch_concurrent"],
      ["paykit_payment_method", "stripe_payment_method_id", "pm_concurrent"],
    ]) {
      const result = await database.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table} WHERE ${column} = $1`,
        [id],
      );
      expect(result.rows[0]?.count).toBe("1");
    }
  });
});
