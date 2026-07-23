import { describe, expect, it } from "vitest";

import { subscribeBodySchema } from "../subscription.types";

const validSubscribeBody = {
  planId: "restaurant-live",
  successUrl: "https://app.example.com/billing/success",
};

describe("subscribeBodySchema", () => {
  it("accepts missing quantity for the default quantity path", () => {
    expect(subscribeBodySchema.safeParse(validSubscribeBody).success).toBe(true);
  });

  it("accepts a positive integer quantity", () => {
    expect(subscribeBodySchema.safeParse({ ...validSubscribeBody, quantity: 3 }).success).toBe(
      true,
    );
  });

  it("rejects zero, negative, and decimal quantities", () => {
    expect(subscribeBodySchema.safeParse({ ...validSubscribeBody, quantity: 0 }).success).toBe(
      false,
    );
    expect(subscribeBodySchema.safeParse({ ...validSubscribeBody, quantity: -1 }).success).toBe(
      false,
    );
    expect(subscribeBodySchema.safeParse({ ...validSubscribeBody, quantity: 1.5 }).success).toBe(
      false,
    );
  });
});
