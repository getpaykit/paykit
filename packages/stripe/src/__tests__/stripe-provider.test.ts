import { describe, expect, it } from "vitest";

import { stripe } from "../stripe-provider";

describe("@paykitjs/stripe", () => {
  it("should return a provider config with createAdapter", () => {
    const config = stripe({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    });

    expect(config.id).toBe("stripe");
    expect(config.name).toBe("Stripe");
    expect(typeof config.createAdapter).toBe("function");
  });

  it("should create a PaymentProvider adapter", () => {
    const config = stripe({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    });

    const adapter = config.createAdapter();
    expect(adapter.id).toBe("stripe");
    expect(adapter.name).toBe("Stripe");
    expect(typeof adapter.createCustomer).toBe("function");
    expect(typeof adapter.updateCustomer).toBe("function");
    expect(typeof adapter.archiveProduct).toBe("function");
    expect(typeof adapter.handleWebhook).toBe("function");
  });
});
