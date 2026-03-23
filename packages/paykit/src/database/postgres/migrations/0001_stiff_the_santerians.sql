CREATE TABLE "paykit_product" (
	"internal_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"price_amount" integer NOT NULL,
	"price_interval" text,
	"provider_product_id" text,
	"provider_price_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_product_id_version_unique" ON "paykit_product" USING btree ("id","version");