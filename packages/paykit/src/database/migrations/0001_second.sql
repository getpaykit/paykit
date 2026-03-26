CREATE TABLE "paykit_customer_entitlement" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_product_id" text,
	"customer_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"unlimited" boolean DEFAULT false NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"next_reset_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_customer_price" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_product_id" text NOT NULL,
	"price_id" text NOT NULL,
	"options" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_customer_product" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"product_internal_id" text NOT NULL,
	"subscription_id" text,
	"provider_id" text NOT NULL,
	"provider_checkout_session_id" text,
	"status" text NOT NULL,
	"canceled" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"trial_ends_at" timestamp,
	"current_period_start_at" timestamp,
	"current_period_end_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"scheduled_product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_feature" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_id" text,
	"provider_id" text NOT NULL,
	"provider_invoice_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"total_amount" integer NOT NULL,
	"hosted_url" text,
	"period_start_at" timestamp,
	"period_end_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"provider_checkout_session_id" text,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_price" (
	"id" text PRIMARY KEY NOT NULL,
	"product_internal_id" text NOT NULL,
	"amount" integer NOT NULL,
	"interval" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_product_feature" (
	"product_internal_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"limit" integer,
	"reset_interval" text,
	"config" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "paykit_product_feature_product_internal_id_feature_id_pk" PRIMARY KEY("product_internal_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "paykit_provider_price" (
	"price_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_price_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "paykit_provider_price_price_id_provider_id_pk" PRIMARY KEY("price_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "paykit_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_product_id" text,
	"provider_id" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_subscription_schedule_id" text,
	"status" text NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start_at" timestamp,
	"current_period_end_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "paykit_product" ADD COLUMN "group" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "paykit_product" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_entitlement" ADD CONSTRAINT "paykit_customer_entitlement_feature_id_paykit_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."paykit_feature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_price" ADD CONSTRAINT "paykit_customer_price_price_id_paykit_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."paykit_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_product" ADD CONSTRAINT "paykit_customer_product_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_customer_product" ADD CONSTRAINT "paykit_customer_product_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD CONSTRAINT "paykit_invoice_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD CONSTRAINT "paykit_invoice_subscription_id_paykit_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."paykit_subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_price" ADD CONSTRAINT "paykit_price_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_product_feature" ADD CONSTRAINT "paykit_product_feature_product_internal_id_paykit_product_internal_id_fk" FOREIGN KEY ("product_internal_id") REFERENCES "public"."paykit_product"("internal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_product_feature" ADD CONSTRAINT "paykit_product_feature_feature_id_paykit_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."paykit_feature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_provider_price" ADD CONSTRAINT "paykit_provider_price_price_id_paykit_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."paykit_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD CONSTRAINT "paykit_subscription_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD CONSTRAINT "paykit_subscription_customer_product_id_paykit_customer_product_id_fk" FOREIGN KEY ("customer_product_id") REFERENCES "public"."paykit_customer_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paykit_customer_entitlement_customer_product_idx" ON "paykit_customer_entitlement" USING btree ("customer_product_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_entitlement_customer_feature_idx" ON "paykit_customer_entitlement" USING btree ("customer_id","feature_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_price_customer_product_idx" ON "paykit_customer_price" USING btree ("customer_product_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_price_price_idx" ON "paykit_customer_price" USING btree ("price_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_customer_product_checkout_session_unique" ON "paykit_customer_product" USING btree ("provider_id","provider_checkout_session_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_product_customer_status_idx" ON "paykit_customer_product" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "paykit_customer_product_subscription_idx" ON "paykit_customer_product" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_invoice_provider_unique" ON "paykit_invoice" USING btree ("provider_id","provider_invoice_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_customer_idx" ON "paykit_invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_subscription_idx" ON "paykit_invoice" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_metadata_checkout_session_unique" ON "paykit_metadata" USING btree ("provider_id","provider_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_price_product_internal_id_unique" ON "paykit_price" USING btree ("product_internal_id");--> statement-breakpoint
CREATE INDEX "paykit_price_interval_idx" ON "paykit_price" USING btree ("interval");--> statement-breakpoint
CREATE INDEX "paykit_product_feature_feature_idx" ON "paykit_product_feature" USING btree ("feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_subscription_provider_unique" ON "paykit_subscription" USING btree ("provider_id","provider_subscription_id");--> statement-breakpoint
CREATE INDEX "paykit_subscription_customer_status_idx" ON "paykit_subscription" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "paykit_subscription_customer_product_idx" ON "paykit_subscription" USING btree ("customer_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_webhook_event_provider_unique" ON "paykit_webhook_event" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "paykit_webhook_event_status_idx" ON "paykit_webhook_event" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "paykit_product_default_idx" ON "paykit_product" USING btree ("is_default");--> statement-breakpoint
ALTER TABLE "paykit_product" DROP COLUMN "price_amount";--> statement-breakpoint
ALTER TABLE "paykit_product" DROP COLUMN "price_interval";--> statement-breakpoint
ALTER TABLE "paykit_provider_product" DROP COLUMN "provider_price_id";