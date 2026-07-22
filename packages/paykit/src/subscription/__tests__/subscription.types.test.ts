import { describe, expect, it } from "vitest";

import { subscribeBodySchema } from "../subscription.types";

const validSubscribeInput = {
  planId: "restaurant-live",
  successUrl: "https://app.example.com/success",
};

describe("subscription/types", () => {
  it("accepts checkout hardening options", () => {
    const result = subscribeBodySchema.safeParse({
      ...validSubscribeInput,
      checkout: {
        allowPromotionCodes: true,
        automaticTax: { enabled: true },
        billingAddressCollection: "required",
        customerUpdate: {
          address: "auto",
          name: "auto",
          shipping: "never",
        },
        idempotencyKey: "checkout_123",
        taxIdCollection: {
          enabled: true,
          required: "if_supported",
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid checkout idempotency keys", () => {
    expect(
      subscribeBodySchema.safeParse({
        ...validSubscribeInput,
        checkout: { idempotencyKey: "" },
      }).success,
    ).toBe(false);
    expect(
      subscribeBodySchema.safeParse({
        ...validSubscribeInput,
        checkout: { idempotencyKey: "x".repeat(256) },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid checkout option enums", () => {
    expect(
      subscribeBodySchema.safeParse({
        ...validSubscribeInput,
        checkout: { billingAddressCollection: "always" },
      }).success,
    ).toBe(false);
    expect(
      subscribeBodySchema.safeParse({
        ...validSubscribeInput,
        checkout: { taxIdCollection: { enabled: true, required: "always" } },
      }).success,
    ).toBe(false);
  });
});
