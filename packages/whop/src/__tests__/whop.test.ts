import { PAYKIT_ERROR_CODES } from "paykitjs";
import { describe, expect, it, vi } from "vitest";

import { createWhopProvider } from "../whop-provider";

type WhopClientMock = {
  checkoutConfigurations: { create: ReturnType<typeof vi.fn> };
  memberships: {
    cancel: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  webhooks: { unwrap: ReturnType<typeof vi.fn> };
  payments: { list: ReturnType<typeof vi.fn> };
  members: { list: ReturnType<typeof vi.fn> };
};

function createClient(overrides: Partial<WhopClientMock> = {}): WhopClientMock {
  const base: WhopClientMock = {
    checkoutConfigurations: { create: vi.fn() },
    memberships: { cancel: vi.fn(), list: vi.fn(), resume: vi.fn() },
    webhooks: { unwrap: vi.fn() },
    payments: { list: vi.fn() },
    members: { list: vi.fn() },
  };

  return {
    ...base,
    ...overrides,
    checkoutConfigurations: {
      ...base.checkoutConfigurations,
      ...overrides.checkoutConfigurations,
    },
    memberships: {
      ...base.memberships,
      ...overrides.memberships,
    },
    webhooks: {
      ...base.webhooks,
      ...overrides.webhooks,
    },
    payments: {
      ...base.payments,
      ...overrides.payments,
    },
    members: {
      ...base.members,
      ...overrides.members,
    },
  };
}

describe("providers/whop", () => {
  it("creates a checkout session and returns a payment URL", async () => {
    const createCheckout = vi
      .fn()
      .mockResolvedValue({ id: "checkout_123", purchase_url: "https://whop.com/p/123" });
    const client = createClient({ checkoutConfigurations: { create: createCheckout } });
    const provider = createWhopProvider(client as never, {
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    const result = await provider.createSubscriptionCheckout({
      cancelUrl: "https://example.com/cancel",
      metadata: { ref: "abc" },
      providerCustomerId: "cus_123",
      providerProduct: { productId: "plan_123" },
      successUrl: "https://example.com/success",
    });

    expect(createCheckout).toHaveBeenCalledWith({
      plan_id: "plan_123",
      metadata: { ref: "abc" },
      redirect_url: "https://example.com/success",
    });
    expect(result).toEqual({
      paymentUrl: "https://whop.com/p/123",
      providerCheckoutSessionId: "checkout_123",
    });
  });

  it("throws when a checkout session does not include a purchase URL", async () => {
    const createCheckout = vi.fn().mockResolvedValue({ id: "checkout_123" });
    const client = createClient({ checkoutConfigurations: { create: createCheckout } });
    const provider = createWhopProvider(client as never, {
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    await expect(
      provider.createSubscriptionCheckout({
        providerCustomerId: "cus_123",
        providerProduct: { productId: "plan_123" },
        successUrl: "https://example.com/success",
      }),
    ).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID.code,
    });
  });

  it("normalizes subscription events from membership webhooks", async () => {
    const unwrap = vi.fn().mockReturnValue({
      type: "membership.cancel_at_period_end_changed",
      data: {
        id: "sub_123",
        user: { id: "user_123" },
        product: { id: "prod_123" },
        cancel_at_period_end: true,
        canceled_at: "2024-01-10T00:00:00.000Z",
        renewal_period_start: "2024-01-01T00:00:00.000Z",
        renewal_period_end: "2024-02-01T00:00:00.000Z",
        status: "active",
      },
    });
    const client = createClient({ webhooks: { unwrap } });
    const provider = createWhopProvider(client as never, {
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    const [event] = await provider.handleWebhook({
      body: "{}",
      headers: { "webhook-id": "evt_123" },
    });

    expect(event.name).toBe("subscription.updated");
    expect(event.payload.providerEventId).toBe("evt_123");
    expect(event.payload.providerCustomerId).toBe("user_123");
    expect(event.payload.subscription).toMatchObject({
      cancelAtPeriodEnd: true,
      providerProduct: { productId: "prod_123" },
      providerSubscriptionId: "sub_123",
      providerSubscriptionScheduleId: null,
      status: "active",
    });
    expect(event.payload.subscription?.canceledAt).toEqual(new Date("2024-01-10T00:00:00.000Z"));
    expect(event.payload.subscription?.currentPeriodStartAt).toEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
    expect(event.payload.subscription?.currentPeriodEndAt).toEqual(
      new Date("2024-02-01T00:00:00.000Z"),
    );
    expect(event.payload.subscription?.endedAt).toBeNull();
  });

  it("normalizes checkout events from payment webhooks", async () => {
    const unwrap = vi.fn().mockReturnValue({
      type: "payment.created",
      data: {
        id: "pay_123",
        status: "paid",
        user: { id: "user_123" },
        membership: { id: "sub_456" },
        metadata: { seats: 2, note: "VIP" },
      },
    });
    const client = createClient({ webhooks: { unwrap } });
    const provider = createWhopProvider(client as never, {
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    const [event] = await provider.handleWebhook({
      body: "{}",
      headers: { "webhook-id": "evt_456" },
    });

    expect(event).toEqual({
      name: "checkout.completed",
      payload: {
        checkoutSessionId: "pay_123",
        mode: "subscription",
        paymentStatus: "paid",
        providerCustomerId: "user_123",
        providerEventId: "evt_456",
        providerSubscriptionId: "sub_456",
        status: "paid",
        metadata: { seats: "2", note: "VIP" },
      },
    });
  });

  it("throws a clear error when webhook signatures are invalid", async () => {
    const unwrap = vi.fn().mockImplementation(() => {
      throw new Error("invalid");
    });
    const client = createClient({ webhooks: { unwrap } });
    const provider = createWhopProvider(client as never, {
      apiKey: "whop_test_123",
      companyId: "biz_123",
    });

    await expect(
      provider.handleWebhook({
        body: "{}",
        headers: { "webhook-id": "evt_789" },
      }),
    ).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING.code,
    });
  });
});
