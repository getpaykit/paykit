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

export const feature = pgTable("feature", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const product = pgTable(
  "product",
  {
    internalId: text("internal_id").primaryKey(),
    id: text("id").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    group: text("group").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_product_id_version_unique").on(table.id, table.version),
    index("paykit_product_default_idx").on(table.isDefault),
  ],
);

export const price = pgTable(
  "price",
  {
    id: text("id").primaryKey(),
    productInternalId: text("product_internal_id")
      .notNull()
      .references(() => product.internalId),
    amount: integer("amount").notNull(),
    interval: text("interval").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_price_product_internal_id_unique").on(table.productInternalId),
    index("paykit_price_interval_idx").on(table.interval),
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
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productInternalId, table.featureId] }),
    index("paykit_product_feature_feature_idx").on(table.featureId),
  ],
);

export const providerProduct = pgTable(
  "provider_product",
  {
    productInternalId: text("product_internal_id")
      .notNull()
      .references(() => product.internalId),
    providerId: text("provider_id").notNull(),
    providerProductId: text("provider_product_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.productInternalId, table.providerId] })],
);

export const providerPrice = pgTable(
  "provider_price",
  {
    priceId: text("price_id")
      .notNull()
      .references(() => price.id),
    providerId: text("provider_id").notNull(),
    providerPriceId: text("provider_price_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.priceId, table.providerId] })],
);

export const customerProduct = pgTable(
  "customer_product",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    productInternalId: text("product_internal_id")
      .notNull()
      .references(() => product.internalId),
    subscriptionId: text("subscription_id"),
    providerId: text("provider_id").notNull(),
    providerCheckoutSessionId: text("provider_checkout_session_id"),
    status: text("status").notNull(),
    canceled: boolean("canceled").notNull().default(false),
    startedAt: timestamp("started_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    currentPeriodStartAt: timestamp("current_period_start_at"),
    currentPeriodEndAt: timestamp("current_period_end_at"),
    canceledAt: timestamp("canceled_at"),
    endedAt: timestamp("ended_at"),
    scheduledProductId: text("scheduled_product_id"),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_customer_product_checkout_session_unique").on(
      table.providerId,
      table.providerCheckoutSessionId,
    ),
    index("paykit_customer_product_customer_status_idx").on(table.customerId, table.status),
    index("paykit_customer_product_subscription_idx").on(table.subscriptionId),
  ],
);

export const customerPrice = pgTable(
  "customer_price",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    customerProductId: text("customer_product_id")
      .notNull()
      .references(() => customerProduct.id),
    priceId: text("price_id")
      .notNull()
      .references(() => price.id),
    options: jsonb("options").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("paykit_customer_price_customer_product_idx").on(table.customerProductId),
    index("paykit_customer_price_price_idx").on(table.priceId),
  ],
);

export const customerEntitlement = pgTable(
  "customer_entitlement",
  {
    id: text("id").primaryKey(),
    customerProductId: text("customer_product_id").references(() => customerProduct.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    featureId: text("feature_id")
      .notNull()
      .references(() => feature.id),
    unlimited: boolean("unlimited").notNull().default(false),
    balance: integer("balance").notNull().default(0),
    nextResetAt: timestamp("next_reset_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("paykit_customer_entitlement_customer_product_idx").on(table.customerProductId),
    index("paykit_customer_entitlement_customer_feature_idx").on(table.customerId, table.featureId),
  ],
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id),
    customerProductId: text("customer_product_id").references(() => customerProduct.id),
    providerId: text("provider_id").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    providerSubscriptionScheduleId: text("provider_subscription_schedule_id"),
    status: text("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStartAt: timestamp("current_period_start_at"),
    currentPeriodEndAt: timestamp("current_period_end_at"),
    canceledAt: timestamp("canceled_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_subscription_provider_unique").on(
      table.providerId,
      table.providerSubscriptionId,
    ),
    index("paykit_subscription_customer_status_idx").on(table.customerId, table.status),
    index("paykit_subscription_customer_product_idx").on(table.customerProductId),
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
    providerId: text("provider_id").notNull(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    totalAmount: integer("total_amount").notNull(),
    hostedUrl: text("hosted_url"),
    periodStartAt: timestamp("period_start_at"),
    periodEndAt: timestamp("period_end_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("paykit_invoice_provider_unique").on(table.providerId, table.providerInvoiceId),
    index("paykit_invoice_customer_idx").on(table.customerId),
    index("paykit_invoice_subscription_idx").on(table.subscriptionId),
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
    createdAt: timestamp("created_at").notNull(),
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
    receivedAt: timestamp("received_at").notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    uniqueIndex("paykit_webhook_event_provider_unique").on(table.providerId, table.providerEventId),
    index("paykit_webhook_event_status_idx").on(table.providerId, table.status),
  ],
);

export const plan = product;
export const providerPlan = providerProduct;
