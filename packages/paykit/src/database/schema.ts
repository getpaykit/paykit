import {
  boolean,
  index,
  integer,
  jsonb,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { ProviderCustomerMap } from "../providers/provider";

const pgTable = pgTableCreator((name) => `paykit_${name}`);

const createdAt = timestamp("created_at")
  .notNull()
  .$defaultFn(() => new Date());
const updatedAt = timestamp("updated_at")
  .notNull()
  .$defaultFn(() => new Date())
  .$onUpdateFn(() => new Date());

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    name: text("name"),
    metadata: jsonb("metadata").$type<Record<string, string> | null>(),
    provider: jsonb("provider").$type<ProviderCustomerMap>().notNull().default({}),
    deletedAt: timestamp("deleted_at"),
    createdAt,
    updatedAt,
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
    providerData: jsonb("provider_data").$type<Record<string, unknown>>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("paykit_payment_method_customer_idx").on(table.customerId, table.deletedAt),
    index("paykit_payment_method_provider_idx").on(table.providerId),
  ],
);

export const feature = pgTable("feature", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt,
  updatedAt,
});

type ProviderProductMap = Record<string, { productId: string; priceId: string | null }>;

export const product = pgTable(
  "product",
  {
    internalId: text("internal_id").primaryKey(),
    id: text("id").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    group: text("group").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    priceAmount: integer("price_amount"),
    priceInterval: text("price_interval"),
    hash: text("hash"),
    provider: jsonb("provider").$type<ProviderProductMap>().notNull().default({}),
    archivedAt: timestamp("archived_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("paykit_product_id_version_unique").on(table.id, table.version),
    index("paykit_product_default_idx").on(table.isDefault),
    index("paykit_product_archived_at_idx").on(table.archivedAt),
  ],
);

export const productFeature = pgTable(
  "product_feature",
  {
    productInternalId: text("product_internal_id")
      .notNull()
      .references(() => product.internalId),
    featureId: text("feature_id")
      .notNull()
      .references(() => feature.id),
    limit: integer("limit"),
    resetInterval: text("reset_interval"),
    config: jsonb("config").$type<Record<string, unknown> | null>(),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.productInternalId, table.featureId] }),
    index("paykit_product_feature_feature_idx").on(table.featureId),
  ],
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    productInternalId: text("product_internal_id")
      .notNull()
      .references(() => product.internalId),
    providerId: text("provider_id"),
    providerData: jsonb("provider_data").$type<Record<string, unknown> | null>(),
    status: text("status").notNull(),
    canceled: boolean("canceled").notNull().default(false),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    startedAt: timestamp("started_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    currentPeriodStartAt: timestamp("current_period_start_at"),
    currentPeriodEndAt: timestamp("current_period_end_at"),
    canceledAt: timestamp("canceled_at"),
    endedAt: timestamp("ended_at"),
    scheduledProductId: text("scheduled_product_id"),
    quantity: integer("quantity").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("paykit_subscription_customer_status_idx").on(
      table.customerId,
      table.status,
      table.endedAt,
    ),
    index("paykit_subscription_product_idx").on(table.productInternalId),
    index("paykit_subscription_provider_idx").on(table.providerId),
  ],
);

export const entitlement = pgTable(
  "entitlement",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    featureId: text("feature_id")
      .notNull()
      .references(() => feature.id),
    limit: integer("limit"),
    balance: integer("balance"),
    nextResetAt: timestamp("next_reset_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("paykit_entitlement_subscription_idx").on(table.subscriptionId),
    index("paykit_entitlement_customer_feature_idx").on(table.customerId, table.featureId),
    index("paykit_entitlement_next_reset_idx").on(table.nextResetAt),
  ],
);

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    type: text("type").notNull(),
    status: text("status").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    description: text("description"),
    hostedUrl: text("hosted_url"),
    providerId: text("provider_id").notNull(),
    providerData: jsonb("provider_data").$type<Record<string, unknown>>().notNull(),
    periodStartAt: timestamp("period_start_at"),
    periodEndAt: timestamp("period_end_at"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("paykit_invoice_customer_idx").on(table.customerId, table.createdAt),
    index("paykit_invoice_subscription_idx").on(table.subscriptionId),
    index("paykit_invoice_provider_idx").on(table.providerId),
  ],
);

export const metadata = pgTable(
  "metadata",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    providerCheckoutSessionId: text("provider_checkout_session_id"),
    expiresAt: timestamp("expires_at"),
    createdAt,
  },
  (table) => [
    uniqueIndex("paykit_metadata_checkout_session_unique").on(
      table.providerId,
      table.providerCheckoutSessionId,
    ),
  ],
);

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    error: text("error"),
    traceId: text("trace_id"),
    receivedAt: timestamp("received_at").notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    uniqueIndex("paykit_webhook_event_provider_unique").on(table.providerId, table.providerEventId),
    index("paykit_webhook_event_status_idx").on(table.providerId, table.status),
  ],
);
