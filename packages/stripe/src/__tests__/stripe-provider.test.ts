import { describe, expect, it } from "vitest";

import { stripe } from "../stripe-provider";

describe("@paykitjs/stripe", () => {
  it("should return a Stripe provider config for core to consume", () => {
    const config = stripe({
      currency: "usd",
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    });

    expect(config).toEqual({
      currency: "usd",
      id: "stripe",
      kind: "stripe",
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    });
  });
});
