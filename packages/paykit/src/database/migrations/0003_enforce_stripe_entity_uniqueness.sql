DELETE FROM "paykit_invoice" AS duplicate
USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "stripe_invoice_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS rank
  FROM "paykit_invoice"
  WHERE "stripe_invoice_id" IS NOT NULL
) AS ranked
WHERE duplicate."id" = ranked."id" AND ranked.rank > 1;--> statement-breakpoint
DELETE FROM "paykit_invoice" AS duplicate
USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "stripe_payment_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS rank
  FROM "paykit_invoice"
  WHERE "stripe_payment_id" IS NOT NULL
) AS ranked
WHERE duplicate."id" = ranked."id" AND ranked.rank > 1;--> statement-breakpoint
DELETE FROM "paykit_payment_method" AS duplicate
USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "stripe_payment_method_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS rank
  FROM "paykit_payment_method"
  WHERE "stripe_payment_method_id" IS NOT NULL
) AS ranked
WHERE duplicate."id" = ranked."id" AND ranked.rank > 1;--> statement-breakpoint
DROP INDEX "paykit_invoice_stripe_invoice_idx";--> statement-breakpoint
DROP INDEX "paykit_invoice_stripe_payment_idx";--> statement-breakpoint
DROP INDEX "paykit_payment_method_stripe_payment_method_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_invoice_stripe_invoice_unique" ON "paykit_invoice" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_invoice_stripe_payment_unique" ON "paykit_invoice" USING btree ("stripe_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_payment_method_stripe_payment_method_unique" ON "paykit_payment_method" USING btree ("stripe_payment_method_id");
