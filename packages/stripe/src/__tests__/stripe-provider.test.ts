import { describe, expect, it } from "vitest";

import { stripe } from "../stripe-provider";

describe("@paykitjs/stripe", () => {
  it("should return a provider", () => {
    const provider = stripe({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    });

    expect(provider.id).toBe("stripe");
    expect(provider.name).toBe("Stripe");
    expect(typeof provider.createCustomer).toBe("function");
    expect(typeof provider.updateCustomer).toBe("function");
    expect(typeof provider.parseWebhook).toBe("function");
  });
});
