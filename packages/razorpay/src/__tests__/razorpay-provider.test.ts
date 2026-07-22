import { describe, expect, it } from "vitest";

import { razorpay } from "../razorpay-provider";

describe("@paykitjs/razorpay", () => {
  it("should return a provider config with createAdapter", () => {
    const config = razorpay({
      keyId: "rzp_test_123",
      keySecret: "secret_test_123",
      webhookSecret: "whsec_test_123",
    });

    expect(config.id).toBe("razorpay");
    expect(config.name).toBe("Razorpay");
    expect(typeof config.createAdapter).toBe("function");
  });

  it("should create a PaymentProvider adapter", () => {
    const config = razorpay({
      keyId: "rzp_test_123",
      keySecret: "secret_test_123",
      webhookSecret: "whsec_test_123",
    });

    const adapter = config.createAdapter();
    expect(adapter.id).toBe("razorpay");
    expect(adapter.name).toBe("Razorpay");
    expect(typeof adapter.createCustomer).toBe("function");
    expect(typeof adapter.updateCustomer).toBe("function");
    expect(typeof adapter.handleWebhook).toBe("function");
    expect(typeof adapter.check).toBe("function");
  });
});
