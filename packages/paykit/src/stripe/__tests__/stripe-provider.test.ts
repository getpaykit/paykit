import { describe, expect, it, vi } from "vitest";

import { createStripeProvider } from "../stripe-provider";

function createStripeClientMock() {
  return {
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
});
