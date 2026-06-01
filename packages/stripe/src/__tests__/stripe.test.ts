import { PAYKIT_ERROR_CODES } from "paykitjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeSdkMock = vi.hoisted(() => ({
  client: null as unknown,
  Stripe: vi.fn(function Stripe() {
    return stripeSdkMock.client;
  }),
}));

vi.mock("stripe", () => ({
  default: stripeSdkMock.Stripe,
}));

import { stripe, type StripeOptions } from "../stripe-provider";

function createRuntime(client: unknown, options: Partial<StripeOptions> = {}) {
  stripeSdkMock.client = client;
  return stripe({
    secretKey: "sk_test_123",
    webhookSecret: "whsec_123",
    ...options,
  });
}

describe("providers/stripe", () => {
  beforeEach(() => {
    stripeSdkMock.Stripe.mockClear();
    stripeSdkMock.client = null;
  });

  it("creates a test clock and stores its id on the provider customer", async () => {
    const createClock = vi.fn().mockResolvedValue({
      frozen_time: 1_700_000_000,
      id: "clock_123",
      name: "customer_123",
      status: "ready",
    });
    const createCustomer = vi.fn().mockResolvedValue({ id: "cus_123" });
    const runtime = createRuntime({
      customers: { create: createCustomer },
      testHelpers: {
        testClocks: {
          advance: vi.fn(),
          create: createClock,
          retrieve: vi.fn(),
        },
      },
    });

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
    const runtime = createRuntime(
      {
        customers: { create: vi.fn() },
        testHelpers: {
          testClocks: {
            advance: vi.fn(),
            create: vi.fn(),
            retrieve: vi.fn(),
          },
        },
      },
      {
        secretKey: "sk_live_123",
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
    const runtime = createRuntime({
      customers: { create: vi.fn() },
      testHelpers: {
        testClocks: {
          advance: advanceClock,
          create: vi.fn(),
          retrieve: retrieveClock,
        },
      },
    });
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
      return createRuntime(
        {
          checkout: { sessions: { create: createSession } },
        },
        {
          apiVersion: managedPayments ? "2026-03-04.preview" : undefined,
          managedPayments,
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
