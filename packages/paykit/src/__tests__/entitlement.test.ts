import { describe, expect, it } from "vitest";

import type { PayKitContext } from "../core/context";
import { paymentMethod } from "../database/schema";
import { createPayKit, feature, plan } from "../index";
import { syncCustomer } from "../services/customer-service";
import { syncProducts } from "../services/product-sync-service";
import { createMigratedTestPool, mockProvider } from "../test-utils";

const messagesFeature = feature({
  id: "messages",
  type: "metered",
});

const proModelsFeature = feature({
  id: "pro_models",
  type: "boolean",
});

const free = plan({
  default: true,
  group: "base",
  id: "free",
  includes: [messagesFeature({ limit: 50, reset: "month" })],
});

const pro = plan({
  group: "base",
  id: "pro",
  includes: [messagesFeature({ limit: 1000, reset: "month" }), proModelsFeature()],
  price: { amount: 20, interval: "month" },
});

async function setupTest() {
  const pool = await createMigratedTestPool();
  const paykit = createPayKit({
    database: pool,
    plans: { free, pro },
    provider: mockProvider(),
  });

  const ctx = (await paykit.$context) as PayKitContext;
  await syncProducts(ctx);
  await syncCustomer(ctx.database, {
    email: "test@example.com",
    id: "user_1",
    name: "Test User",
  });

  // Insert a default payment method so subscribe goes direct (not checkout)
  await ctx.database.insert(paymentMethod).values({
    createdAt: new Date("2026-03-08T00:00:00.000Z"),
    customerId: "user_1",
    deletedAt: null,
    expiryMonth: 10,
    expiryYear: 2030,
    id: "pm_local_1",
    isDefault: true,
    last4: "4242",
    providerId: "mock",
    providerMethodId: "pm_mock_1",
    type: "card",
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
  });

  return { ctx, paykit, pool };
}

describe("check", () => {
  it("should return allowed=false when no entitlements exist", async () => {
    const { paykit } = await setupTest();

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.allowed).toBe(false);
    expect(result.balance).toBeNull();
  });

  it("should return allowed=true with correct balance for metered feature", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.allowed).toBe(true);
    expect(result.balance).not.toBeNull();
    expect(result.balance!.remaining).toBe(1000);
    expect(result.balance!.limit).toBe(1000);
    expect(result.balance!.unlimited).toBe(false);
    expect(result.balance!.resetAt).toBeInstanceOf(Date);
  });

  it("should return allowed=true with unlimited for boolean feature", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "pro_models",
    });

    expect(result.allowed).toBe(true);
    expect(result.balance).not.toBeNull();
    expect(result.balance!.unlimited).toBe(true);
  });

  it("should return allowed=false when balance is insufficient", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "free",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "messages",
      required: 51,
    });

    expect(result.allowed).toBe(false);
    expect(result.balance).not.toBeNull();
    expect(result.balance!.remaining).toBe(50);
  });

  it("should lazy-reset balance when nextResetAt has passed", async () => {
    const { paykit, pool } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    // Drain the balance and set nextResetAt to the past
    await pool.query(`
      UPDATE paykit_customer_entitlement
      SET balance = 0, next_reset_at = now() - INTERVAL '1 hour'
      WHERE customer_id = 'user_1' AND feature_id = 'messages'
    `);

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.allowed).toBe(true);
    expect(result.balance!.remaining).toBe(1000);
    expect(result.balance!.resetAt).not.toBeNull();
    // resetAt should now be in the future
    expect(result.balance!.resetAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should not count entitlements from ended products", async () => {
    const { paykit, pool } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    // End the customer product
    await pool.query(`
      UPDATE paykit_customer_product
      SET status = 'ended', ended_at = now()
      WHERE customer_id = 'user_1'
    `);

    const result = await paykit.check({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.allowed).toBe(false);
    expect(result.balance).toBeNull();
  });
});

describe("report", () => {
  it("should decrement balance by 1 by default", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.success).toBe(true);
    expect(result.balance!.remaining).toBe(999);
  });

  it("should decrement balance by custom amount", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "messages",
      amount: 100,
    });

    expect(result.success).toBe(true);
    expect(result.balance!.remaining).toBe(900);
  });

  it("should return success=false when balance is insufficient", async () => {
    const { paykit, pool } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "free",
      successUrl: "https://example.com/success",
    });

    // Drain to 0
    await pool.query(`
      UPDATE paykit_customer_entitlement
      SET balance = 0
      WHERE customer_id = 'user_1' AND feature_id = 'messages'
    `);

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.success).toBe(false);
    expect(result.balance!.remaining).toBe(0);
  });

  it("should succeed for unlimited (boolean) features without decrementing", async () => {
    const { paykit } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "pro_models",
    });

    expect(result.success).toBe(true);
    expect(result.balance!.unlimited).toBe(true);
  });

  it("should lazy-reset then deduct in a single call", async () => {
    const { paykit, pool } = await setupTest();

    await paykit.subscribe({
      customerId: "user_1",
      planId: "pro",
      successUrl: "https://example.com/success",
    });

    // Drain balance and expire the reset
    await pool.query(`
      UPDATE paykit_customer_entitlement
      SET balance = 0, next_reset_at = now() - INTERVAL '1 hour'
      WHERE customer_id = 'user_1' AND feature_id = 'messages'
    `);

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "messages",
      amount: 5,
    });

    expect(result.success).toBe(true);
    // After reset (1000) minus deduction (5) = 995
    expect(result.balance!.remaining).toBe(995);
  });

  it("should return success=false when no entitlements exist", async () => {
    const { paykit } = await setupTest();

    const result = await paykit.report({
      customerId: "user_1",
      featureId: "messages",
    });

    expect(result.success).toBe(false);
    expect(result.balance).toBeNull();
  });
});
