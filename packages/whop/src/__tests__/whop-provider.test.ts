import { describe, expect, it } from "vitest";

import { whop } from "../whop-provider";

describe("@paykitjs/whop", () => {
  it("should return a provider config with createAdapter", () => {
    const config = whop({
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    expect(config.id).toBe("whop");
    expect(config.name).toBe("Whop");
    expect(config.capabilities).toEqual({ testClocks: false });
    expect(typeof config.createAdapter).toBe("function");
  });

  it("should create a PaymentProvider adapter", () => {
    const config = whop({
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    const adapter = config.createAdapter();
    expect(adapter.id).toBe("whop");
    expect(adapter.name).toBe("Whop");
    expect(typeof adapter.createSubscriptionCheckout).toBe("function");
    expect(typeof adapter.cancelSubscription).toBe("function");
    expect(typeof adapter.handleWebhook).toBe("function");
    expect(typeof adapter.syncProducts).toBe("function");
  });
});
