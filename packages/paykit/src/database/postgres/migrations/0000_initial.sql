CREATE TABLE "paykit_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"payment_method_id" text,
	"provider_id" text NOT NULL,
	"provider_payment_id" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_payment_method" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_method_id" text NOT NULL,
	"type" text NOT NULL,
	"last4" text,
	"expiry_month" integer,
	"expiry_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paykit_provider_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paykit_payment" ADD CONSTRAINT "paykit_payment_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_payment" ADD CONSTRAINT "paykit_payment_payment_method_id_paykit_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."paykit_payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_payment_method" ADD CONSTRAINT "paykit_payment_method_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paykit_provider_customer" ADD CONSTRAINT "paykit_provider_customer_customer_id_paykit_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."paykit_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paykit_customer_deleted_at_idx" ON "paykit_customer" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_payment_provider_unique" ON "paykit_payment" USING btree ("provider_id","provider_payment_id");--> statement-breakpoint
CREATE INDEX "paykit_payment_customer_provider_idx" ON "paykit_payment" USING btree ("customer_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_payment_method_provider_unique" ON "paykit_payment_method" USING btree ("provider_id","provider_method_id");--> statement-breakpoint
CREATE INDEX "paykit_payment_method_customer_provider_idx" ON "paykit_payment_method" USING btree ("customer_id","provider_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_provider_customer_customer_provider_unique" ON "paykit_provider_customer" USING btree ("customer_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paykit_provider_customer_provider_customer_unique" ON "paykit_provider_customer" USING btree ("provider_id","provider_customer_id");