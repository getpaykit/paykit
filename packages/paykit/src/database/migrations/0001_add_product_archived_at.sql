ALTER TABLE "paykit_product" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX "paykit_product_archived_at_idx" ON "paykit_product" USING btree ("archived_at");