ALTER TABLE "paykit_product" ADD COLUMN "price_currency" text;--> statement-breakpoint
UPDATE "paykit_product"
SET "price_currency" = 'usd'
WHERE "price_amount" IS NOT NULL;
