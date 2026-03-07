import {
  boolean,
  index,
  integer,
  jsonb,
  pgTableCreator,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const pgTable = pgTableCreator((name) => `paykit_${name}`);

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    name: text("name"),
    metadata: jsonb("metadata").$type<Record<string, string> | null>(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("paykit_customer_deleted_at_idx").on(table.deletedAt)],
);

export const paymentMethod = pgTable(
  "payment_method",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    providerId: text("provider_id").notNull(),
    providerMethodId: text("provider_method_id").notNull(),
    type: text("type").notNull(),
    last4: text("last4"),
    expiryMonth: integer("expiry_month"),
    expiryYear: integer("expiry_year"),
    isDefault: boolean("is_default").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_payment_method_provider_unique").on(
      table.providerId,
      table.providerMethodId,
    ),
    index("paykit_payment_method_customer_provider_idx").on(
      table.customerId,
      table.providerId,
      table.deletedAt,
    ),
  ],
);

export const providerCustomer = pgTable(
  "provider_customer",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    providerId: text("provider_id").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_provider_customer_customer_provider_unique").on(
      table.customerId,
      table.providerId,
    ),
    uniqueIndex("paykit_provider_customer_provider_customer_unique").on(
      table.providerId,
      table.providerCustomerId,
    ),
  ],
);

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    paymentMethodId: text("payment_method_id").references(() => paymentMethod.id),
    providerId: text("provider_id").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: text("status").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, string> | null>(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_payment_provider_unique").on(table.providerId, table.providerPaymentId),
    index("paykit_payment_customer_provider_idx").on(table.customerId, table.providerId),
  ],
);

export const schema = {
  customer,
  payment,
  paymentMethod,
  providerCustomer,
} as const;
