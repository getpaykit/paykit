import { describe, expect, it, vi } from "vitest";

import { createStripeProvider } from "../stripe-provider";

function createStripeSubscription(quantity = 1) {
  return {
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    id: "sub_123",
    items: {
      data: [
        {
          current_period_end: 1_750_000_000,
          current_period_start: 1_700_000_000,
          id: "si_123",
          price: { id: "price_123", product: "prod_123" },
          quantity,
        },
      ],
    },
    latest_invoice: null,
    schedule: null,
    status: "active",
  };
}

function createStripeClientMock() {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_123", url: "https://checkout.test/session" }),
      },
    },
    invoices: {
      addLines: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "in_123" }),
      finalizeInvoice: vi.fn().mockResolvedValue({
        currency: "eur",
        id: "in_123",
        status: "open",
        total: 2900,
      }),
    },
    prices: {
      create: vi.fn().mockResolvedValue({ id: "price_123" }),
    },
    products: {
      create: vi.fn().mockResolvedValue({ id: "prod_123" }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue(createStripeSubscription(3)),
      retrieve: vi.fn().mockResolvedValue(createStripeSubscription(1)),
      update: vi.fn().mockResolvedValue(createStripeSubscription(4)),
    },
    subscriptionSchedules: {
      create: vi.fn().mockResolvedValue({ id: "sched_123", phases: [] }),
      retrieve: vi.fn().mockResolvedValue({ id: "sched_123", phases: [] }),
      update: vi.fn().mockResolvedValue({ id: "sched_123", phases: [] }),
    },
  };
}

describe("stripe-provider", () => {
  it("creates Stripe prices with the product currency", async () => {
    const client = createStripeClientMock();
    const provider = createStripeProvider(client as never, {
      currency: "usd",
      secretKey: "sk_test_123",
    });

    await provider.syncProducts({
      products: [
        {
          existingProviderProduct: null,
          id: "pro",
          name: "Pro",
          priceAmount: 2900,
          priceCurrency: "eur",
          priceInterval: "month",
        },
      ],
    });

    expect(client.prices.create).toHaveBeenCalledWith({
      currency: "eur",
      product: "prod_123",
      recurring: { interval: "month" },
      unit_amount: 2900,
    });
  });

  it("creates invoices with the configured currency", async () => {
    const client = createStripeClientMock();
    const provider = createStripeProvider(client as never, {
      currency: "eur",
      secretKey: "sk_test_123",
    });

    await provider.createInvoice({
      lines: [],
      providerCustomerId: "cus_123",
    });

    expect(client.invoices.create).toHaveBeenCalledWith({
      auto_advance: true,
      collection_method: "charge_automatically",
      currency: "eur",
      customer: "cus_123",
    });
  });

  it("passes quantity to Stripe Checkout subscription line items", async () => {
    const client = createStripeClientMock();
    const provider = createStripeProvider(client as never, {
      currency: "eur",
      secretKey: "sk_test_123",
    });

    await provider.createSubscriptionCheckout({
      providerCustomerId: "cus_123",
      providerProduct: { priceId: "price_123", productId: "prod_123" },
      quantity: 3,
      successUrl: "https://app.test/success",
    });

    expect(client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_123", quantity: 3 }],
      }),
    );
  });

  it("passes quantity to direct Stripe subscription creation", async () => {
    const client = createStripeClientMock();
    const provider = createStripeProvider(client as never, {
      currency: "eur",
      secretKey: "sk_test_123",
    });

    const result = await provider.createSubscription({
      providerCustomerId: "cus_123",
      providerProduct: { priceId: "price_123", productId: "prod_123" },
      quantity: 3,
    });

    expect(client.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ price: "price_123", quantity: 3 }],
      }),
    );
    expect(result.subscription?.quantity).toBe(3);
  });

  it("passes quantity when updating a Stripe subscription", async () => {
    const client = createStripeClientMock();
    const provider = createStripeProvider(client as never, {
      currency: "eur",
      secretKey: "sk_test_123",
    });

    const result = await provider.updateSubscription({
      providerProduct: { priceId: "price_456", productId: "prod_456" },
      providerSubscriptionId: "sub_123",
      quantity: 4,
    });

    expect(client.subscriptions.update).toHaveBeenCalledWith(
      "sub_123",
      expect.objectContaining({
        items: [{ id: "si_123", price: "price_456", quantity: 4 }],
      }),
    );
    expect(result.subscription?.quantity).toBe(4);
  });

  it("preserves current quantity and applies target quantity for scheduled changes", async () => {
    const client = createStripeClientMock();
    client.subscriptions.retrieve
      .mockResolvedValueOnce(createStripeSubscription(5))
      .mockResolvedValueOnce(createStripeSubscription(2));
    const provider = createStripeProvider(client as never, {
      currency: "eur",
      secretKey: "sk_test_123",
    });

    const result = await provider.scheduleSubscriptionChange({
      providerProduct: { priceId: "price_456", productId: "prod_456" },
      providerSubscriptionId: "sub_123",
      quantity: 2,
    });

    expect(client.subscriptionSchedules.update).toHaveBeenCalledWith(
      "sched_123",
      expect.objectContaining({
        phases: [
          expect.objectContaining({
            items: [{ price: "price_123", quantity: 5 }],
          }),
          expect.objectContaining({
            items: [{ price: "price_456", quantity: 2 }],
          }),
        ],
      }),
    );
    expect(result.subscription?.quantity).toBe(2);
  });
});
