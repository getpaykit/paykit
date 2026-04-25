import { PAYKIT_ERROR_CODES } from "paykitjs";
import { describe, expect, it, vi } from "vitest";

import { createStripeProvider, stripe } from "../stripe-provider";

describe("providers/stripe", () => {
  it("uses usd by default when syncing Stripe prices", async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: "prod_123" });
    const createPrice = vi.fn().mockResolvedValue({ id: "price_123" });
    const runtime = createStripeProvider(
      {
        prices: { create: createPrice },
        products: {
          create: createProduct,
          update: vi.fn(),
        },
      } as never,
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      },
    );

    await runtime.syncProduct({
      id: "pro",
      name: "Pro",
      priceAmount: 1_900,
      priceInterval: "month",
    });

    expect(createPrice).toHaveBeenCalledWith({
      currency: "usd",
      product: "prod_123",
      recurring: { interval: "month" },
      unit_amount: 1_900,
    });
  });

  it("uses the configured currency for Stripe prices and invoices", async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: "prod_123" });
    const createPrice = vi.fn().mockResolvedValue({ id: "price_123" });
    const createInvoice = vi.fn().mockResolvedValue({ id: "in_123" });
    const addLines = vi.fn().mockResolvedValue(undefined);
    const finalizeInvoice = vi.fn().mockResolvedValue({
      currency: "eur",
      hosted_invoice_url: "https://example.com/invoices/in_123",
      id: "in_123",
      period_end: 1_700_000_000,
      period_start: 1_699_913_600,
      status: "open",
      total: 500,
    });
    const runtime = createStripeProvider(
      {
        invoices: {
          addLines,
          create: createInvoice,
          finalizeInvoice,
        },
        prices: { create: createPrice },
        products: {
          create: createProduct,
          update: vi.fn(),
        },
      } as never,
      {
        currency: "EUR",
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      },
    );

    await runtime.syncProduct({
      id: "pro",
      name: "Pro",
      priceAmount: 1_900,
      priceInterval: "month",
    });

    const invoice = await runtime.createInvoice({
      lines: [{ amount: 500, description: "Setup fee" }],
      providerCustomerId: "cus_123",
    });

    expect(createPrice).toHaveBeenCalledWith({
      currency: "eur",
      product: "prod_123",
      recurring: { interval: "month" },
      unit_amount: 1_900,
    });
    expect(createInvoice).toHaveBeenCalledWith({
      auto_advance: true,
      collection_method: "charge_automatically",
      currency: "eur",
      customer: "cus_123",
    });
    expect(invoice).toEqual({
      currency: "eur",
      hostedUrl: "https://example.com/invoices/in_123",
      periodEndAt: new Date(1_700_000_000 * 1000),
      periodStartAt: new Date(1_699_913_600 * 1000),
      providerInvoiceId: "in_123",
      status: "open",
      totalAmount: 500,
    });
  });

  it("creates a test clock and stores its id on the provider customer", async () => {
    const createClock = vi.fn().mockResolvedValue({
      frozen_time: 1_700_000_000,
      id: "clock_123",
      name: "customer_123",
      status: "ready",
    });
    const createCustomer = vi.fn().mockResolvedValue({ id: "cus_123" });
    const runtime = createStripeProvider(
      {
        customers: { create: createCustomer },
        testHelpers: {
          testClocks: {
            advance: vi.fn(),
            create: createClock,
            retrieve: vi.fn(),
          },
        },
      } as never,
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      },
    );

    const result = await runtime.createCustomer({
      createTestClock: true,
      email: "test@example.com",
      id: "customer_123",
      metadata: { role: "tester" },
      name: "Tester",
    });

    expect(createClock).toHaveBeenCalledWith({
      frozen_time: expect.any(Number),
      name: "customer_123",
    });
    expect(createCustomer).toHaveBeenCalledWith({
      email: "test@example.com",
      metadata: {
        customerId: "customer_123",
        role: "tester",
      },
      name: "Tester",
      test_clock: "clock_123",
    });
    expect(result).toEqual({
      providerCustomer: {
        frozenTime: expect.any(String),
        id: "cus_123",
        testClockId: "clock_123",
      },
    });
  });

  it("throws a clear error when testing mode uses a live Stripe key", async () => {
    const runtime = createStripeProvider(
      {
        customers: { create: vi.fn() },
        testHelpers: {
          testClocks: {
            advance: vi.fn(),
            create: vi.fn(),
            retrieve: vi.fn(),
          },
        },
      } as never,
      {
        secretKey: "sk_live_123",
        webhookSecret: "whsec_123",
      },
    );

    await expect(
      runtime.createCustomer({
        createTestClock: true,
        id: "customer_123",
      }),
    ).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.PROVIDER_TEST_KEY_REQUIRED.code,
    });
  });

  it("advances a test clock and returns its normalized state", async () => {
    const advanceClock = vi.fn().mockResolvedValue(undefined);
    const retrieveClock = vi.fn().mockResolvedValue({
      frozen_time: 1_700_086_400,
      id: "clock_123",
      name: "customer_123",
      status: "ready",
    });
    const runtime = createStripeProvider(
      {
        customers: { create: vi.fn() },
        testHelpers: {
          testClocks: {
            advance: advanceClock,
            create: vi.fn(),
            retrieve: retrieveClock,
          },
        },
      } as never,
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      },
    );
    const frozenTime = new Date("2024-01-02T00:00:00.000Z");

    const result = await runtime.advanceTestClock({
      frozenTime,
      testClockId: "clock_123",
    });

    expect(advanceClock).toHaveBeenCalledWith("clock_123", {
      frozen_time: Math.floor(frozenTime.getTime() / 1000),
    });
    expect(result).toEqual({
      frozenTime: new Date(1_700_086_400 * 1000),
      id: "clock_123",
      name: "customer_123",
      status: "ready",
    });
  });

  /** @see https://github.com/getpaykit/paykit/issues/109 */
  describe("managed payments", () => {
    function createCheckoutRuntime(
      createSession: ReturnType<typeof vi.fn>,
      managedPayments: boolean,
    ) {
      return createStripeProvider(
        {
          checkout: { sessions: { create: createSession } },
        } as never,
        {
          managedPayments,
          secretKey: "sk_test_123",
          webhookSecret: "whsec_123",
        },
      );
    }

    it("adds managed_payments to subscription checkout sessions when enabled", async () => {
      const createSession = vi
        .fn()
        .mockResolvedValue({ id: "cs_123", url: "https://checkout.stripe.com/x" });
      const runtime = createCheckoutRuntime(createSession, true);

      await runtime.createSubscriptionCheckout({
        cancelUrl: "https://example.com/cancel",
        metadata: {},
        providerCustomerId: "cus_123",
        providerProduct: { priceId: "price_123" },
        successUrl: "https://example.com/success",
      });

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({ managed_payments: { enabled: true } }),
      );
    });

    it("does not add managed_payments when disabled", async () => {
      const createSession = vi
        .fn()
        .mockResolvedValue({ id: "cs_123", url: "https://checkout.stripe.com/x" });
      const runtime = createCheckoutRuntime(createSession, false);

      await runtime.createSubscriptionCheckout({
        cancelUrl: "https://example.com/cancel",
        metadata: {},
        providerCustomerId: "cus_123",
        providerProduct: { priceId: "price_123" },
        successUrl: "https://example.com/success",
      });

      const params = createSession.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(params.managed_payments).toBeUndefined();
    });

    it("throws when managedPayments is enabled without the preview apiVersion", () => {
      expect(() =>
        stripe({
          managedPayments: true,
          secretKey: "sk_test_123",
          webhookSecret: "whsec_123",
        }),
      ).toThrowError(/managedPayments requires apiVersion/);
    });

    it("succeeds with the minimum preview apiVersion", () => {
      expect(() =>
        stripe({
          apiVersion: "2026-03-04.preview",
          managedPayments: true,
          secretKey: "sk_test_123",
          webhookSecret: "whsec_123",
        }),
      ).not.toThrow();
    });

    it("succeeds with a newer preview apiVersion", () => {
      expect(() =>
        stripe({
          apiVersion: "2027-01-01.preview",
          managedPayments: true,
          secretKey: "sk_test_123",
          webhookSecret: "whsec_123",
        }),
      ).not.toThrow();
    });
  });
});
