CREATE UNIQUE INDEX "paykit_customer_product_active_unique"
  ON "paykit_customer_product" ("customer_id", "provider_id", "product_internal_id")
  WHERE status IN ('active', 'trialing');
