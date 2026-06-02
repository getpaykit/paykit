DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "paykit_customer", jsonb_object_keys("provider") AS provider_key
    WHERE provider_key <> 'stripe'
  ) OR EXISTS (
    SELECT 1
    FROM "paykit_product", jsonb_object_keys("provider") AS provider_key
    WHERE provider_key <> 'stripe'
  ) OR EXISTS (
    SELECT 1 FROM "paykit_payment_method" WHERE "provider_id" <> 'stripe'
  ) OR EXISTS (
    SELECT 1 FROM "paykit_subscription" WHERE "provider_id" IS NOT NULL AND "provider_id" <> 'stripe'
  ) OR EXISTS (
    SELECT 1 FROM "paykit_invoice" WHERE "provider_id" <> 'stripe'
  ) OR EXISTS (
    SELECT 1 FROM "paykit_metadata" WHERE "provider_id" <> 'stripe'
  ) OR EXISTS (
    SELECT 1 FROM "paykit_webhook_event" WHERE "provider_id" <> 'stripe'
  ) THEN
    RAISE EXCEPTION 'PayKit stripe-only migration cannot run because non-Stripe provider data exists. Migration aborted without removing provider data.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "provider_checkout_session_id" AS id
      FROM "paykit_metadata"
      WHERE "provider_id" = 'stripe' AND "provider_checkout_session_id" IS NOT NULL
      GROUP BY 1
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'PayKit stripe-only migration cannot run because duplicate Stripe checkout session IDs exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "provider_event_id" AS id
      FROM "paykit_webhook_event"
      WHERE "provider_id" = 'stripe'
      GROUP BY 1
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'PayKit stripe-only migration cannot run because duplicate Stripe webhook event IDs exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_test_clock_id" text;--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_frozen_time" timestamptz;--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_synced_email" text;--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_synced_name" text;--> statement-breakpoint
ALTER TABLE "paykit_customer" ADD COLUMN "stripe_synced_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD COLUMN "stripe_invoice_id" text;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD COLUMN "stripe_payment_id" text;--> statement-breakpoint
ALTER TABLE "paykit_invoice" ADD COLUMN "stripe_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "paykit_metadata" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "stripe_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "last4" text;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "expiry_month" integer;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD COLUMN "expiry_year" integer;--> statement-breakpoint
ALTER TABLE "paykit_product" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "paykit_product" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "paykit_subscription" ADD COLUMN "stripe_subscription_schedule_id" text;--> statement-breakpoint
ALTER TABLE "paykit_webhook_event" ADD COLUMN "stripe_event_id" text;--> statement-breakpoint
UPDATE "paykit_customer"
SET
  "stripe_customer_id" = "provider"->'stripe'->>'id',
  "stripe_test_clock_id" = "provider"->'stripe'->>'testClockId',
  "stripe_frozen_time" = CASE
    WHEN "provider"->'stripe'->>'frozenTime' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
      THEN ("provider"->'stripe'->>'frozenTime')::timestamptz
    ELSE NULL
  END,
  "stripe_synced_email" = "provider"->'stripe'->>'syncedEmail',
  "stripe_synced_name" = "provider"->'stripe'->>'syncedName',
  "stripe_synced_metadata" = "provider"->'stripe'->'syncedMetadata'
WHERE "provider" ? 'stripe';--> statement-breakpoint
UPDATE "paykit_payment_method"
SET
  "stripe_payment_method_id" = "provider_data"->>'methodId',
  "type" = "provider_data"->>'type',
  "brand" = "provider_data"->>'brand',
  "last4" = "provider_data"->>'last4',
  "expiry_month" = CASE
    WHEN "provider_data"->>'expiryMonth' ~ '^\d+$'
      THEN ("provider_data"->>'expiryMonth')::integer
    ELSE NULL
  END,
  "expiry_year" = CASE
    WHEN "provider_data"->>'expiryYear' ~ '^\d+$'
      THEN ("provider_data"->>'expiryYear')::integer
    ELSE NULL
  END
WHERE "provider_id" = 'stripe';--> statement-breakpoint
UPDATE "paykit_product"
SET
  "stripe_product_id" = "provider"->'stripe'->>'productId',
  "stripe_price_id" = "provider"->'stripe'->>'priceId'
WHERE "provider" ? 'stripe';--> statement-breakpoint
UPDATE "paykit_subscription"
SET
  "stripe_subscription_id" = "provider_data"->>'subscriptionId',
  "stripe_subscription_schedule_id" = "provider_data"->>'subscriptionScheduleId'
WHERE "provider_id" = 'stripe';--> statement-breakpoint
UPDATE "paykit_invoice"
SET
  "stripe_invoice_id" = "provider_data"->>'invoiceId',
  "stripe_payment_id" = "provider_data"->>'paymentId',
  "stripe_payment_method_id" = "provider_data"->>'methodId'
WHERE "provider_id" = 'stripe';--> statement-breakpoint
UPDATE "paykit_metadata"
SET "stripe_checkout_session_id" = "provider_checkout_session_id"
WHERE "provider_id" = 'stripe';--> statement-breakpoint
UPDATE "paykit_webhook_event"
SET "stripe_event_id" = "provider_event_id"
WHERE "provider_id" = 'stripe';--> statement-breakpoint
CREATE INDEX "paykit_customer_stripe_customer_idx" ON "paykit_customer" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "paykit_customer_stripe_test_clock_idx" ON "paykit_customer" USING btree ("stripe_test_clock_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_stripe_invoice_idx" ON "paykit_invoice" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "paykit_invoice_stripe_payment_idx" ON "paykit_invoice" USING btree ("stripe_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_metadata_stripe_checkout_session_unique" ON "paykit_metadata" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "paykit_payment_method_stripe_payment_method_idx" ON "paykit_payment_method" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX "paykit_product_stripe_product_idx" ON "paykit_product" USING btree ("stripe_product_id");--> statement-breakpoint
CREATE INDEX "paykit_product_stripe_price_idx" ON "paykit_product" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "paykit_subscription_stripe_subscription_idx" ON "paykit_subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "paykit_subscription_stripe_schedule_idx" ON "paykit_subscription" USING btree ("stripe_subscription_schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_webhook_event_stripe_event_id_unique" ON "paykit_webhook_event" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "paykit_webhook_event_stripe_status_idx" ON "paykit_webhook_event" USING btree ("status");--> statement-breakpoint
DROP INDEX "paykit_invoice_provider_idx";--> statement-breakpoint
DROP INDEX "paykit_metadata_checkout_session_unique";--> statement-breakpoint
DROP INDEX "paykit_payment_method_provider_idx";--> statement-breakpoint
DROP INDEX "paykit_subscription_provider_idx";--> statement-breakpoint
DROP INDEX "paykit_webhook_event_provider_unique";--> statement-breakpoint
DROP INDEX "paykit_webhook_event_status_idx";--> statement-breakpoint
ALTER TABLE "paykit_customer" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "paykit_product" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "paykit_payment_method" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "paykit_payment_method" DROP COLUMN "provider_data";--> statement-breakpoint
ALTER TABLE "paykit_subscription" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "paykit_subscription" DROP COLUMN "provider_data";--> statement-breakpoint
ALTER TABLE "paykit_invoice" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "paykit_invoice" DROP COLUMN "provider_data";--> statement-breakpoint
ALTER TABLE "paykit_metadata" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "paykit_metadata" DROP COLUMN "provider_checkout_session_id";--> statement-breakpoint
ALTER TABLE "paykit_webhook_event" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "paykit_webhook_event" DROP COLUMN "provider_event_id";--> statement-breakpoint
ALTER TABLE "paykit_webhook_event" ALTER COLUMN "stripe_event_id" SET NOT NULL;
