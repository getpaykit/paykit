import type StripeSdk from "stripe";
import { describe, expect, it, vi } from "vitest";

import { createStripeProvider } from "../stripe-provider";

function createMockStripeClient({
  constructEvent = vi.fn(),
  createCustomer = vi.fn(async () => ({ id: "cus_stripe_123" })),
  createSession,
  detachPaymentMethod = vi.fn(async () => ({})),
  retrievePaymentIntent = vi.fn(),
  retrieveSetupIntent = vi.fn(),
}: {
  constructEvent?: ReturnType<typeof vi.fn>;
  createCustomer?: ReturnType<typeof vi.fn>;
  createSession: ReturnType<typeof vi.fn>;
  detachPaymentMethod?: ReturnType<typeof vi.fn>;
  retrievePaymentIntent?: ReturnType<typeof vi.fn>;
  retrieveSetupIntent?: ReturnType<typeof vi.fn>;
}): StripeSdk {
  return {
    checkout: { sessions: { create: createSession } },
    customers: {
      create: createCustomer,
    },
    paymentIntents: {
      retrieve: retrievePaymentIntent,
    },
    paymentMethods: {
      detach: detachPaymentMethod,
    },
    setupIntents: {
      retrieve: retrieveSetupIntent,
    },
    webhooks: {
      constructEvent,
    },
  } as unknown as StripeSdk;
}

describe("stripe provider", () => {
  it("should create hosted payment checkout sessions", async () => {
    const sessionsCreate = vi.fn(async () => ({
      client_reference_id: "cus_paykit_123",
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    }));

    const provider = createStripeProvider(
      createMockStripeClient({
        createSession: sessionsCreate,
      }),
      {
        currency: "usd",
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    const result = await provider.checkout({
      amount: 1999,
      attachMethod: true,
      description: "E2E checkout",
      metadata: {
        source: "test",
      },
      providerCustomerId: "cus_paykit_123",
      successURL: "https://example.com/success",
    });

    expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(sessionsCreate).toHaveBeenCalledWith({
      cancel_url: "https://example.com/success",
      client_reference_id: "cus_paykit_123",
      customer: "cus_paykit_123",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              description: "E2E checkout",
              name: "E2E checkout",
            },
            unit_amount: 1999,
          },
          quantity: 1,
        },
      ],
      metadata: {
        source: "test",
      },
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      success_url: "https://example.com/success",
    });
  });

  it("should create setup sessions for attachPaymentMethod", async () => {
    const sessionsCreate = vi.fn(async () => ({
      client_reference_id: "cus_paykit_123",
      id: "cs_test_setup",
      url: "https://checkout.stripe.com/c/pay/cs_test_setup",
    }));

    const provider = createStripeProvider(
      createMockStripeClient({
        createSession: sessionsCreate,
      }),
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    const result = await provider.attachPaymentMethod({
      providerCustomerId: "cus_paykit_123",
      returnURL: "https://example.com/settings/billing",
    });

    expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_setup");
    expect(sessionsCreate).toHaveBeenCalledWith({
      cancel_url: "https://example.com/settings/billing",
      client_reference_id: "cus_paykit_123",
      customer: "cus_paykit_123",
      mode: "setup",
      success_url: "https://example.com/settings/billing",
    });
  });

  it("should normalize payment checkout completion into attached, payment, and checkout events", async () => {
    const webhookEvent = {
      data: {
        object: {
          client_reference_id: "cus_paykit_123",
          customer: "cus_stripe_123",
          id: "cs_test_123",
          mode: "payment",
          object: "checkout.session",
          payment_intent: "pi_test_123",
          payment_status: "paid",
          status: "complete",
        },
      },
      id: "evt_test_checkout",
      type: "checkout.session.completed",
    } as StripeSdk.Event;
    const constructEvent = vi.fn(() => webhookEvent);
    const retrievePaymentIntent = vi.fn(async () => ({
      amount: 1999,
      amount_received: 1999,
      created: 1741305600,
      currency: "usd",
      description: "E2E checkout",
      id: "pi_test_123",
      metadata: {
        source: "test",
      },
      payment_method: {
        card: {
          exp_month: 10,
          exp_year: 2031,
          last4: "4242",
        },
        customer: "cus_stripe_123",
        id: "pm_stripe_123",
        type: "card",
      },
      status: "succeeded",
    }));

    const provider = createStripeProvider(
      createMockStripeClient({
        constructEvent,
        createSession: vi.fn(),
        retrievePaymentIntent,
      }),
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    const events = await provider.handleWebhook({
      body: '{"id":"evt_test_checkout"}',
      headers: {
        "stripe-signature": "sig_test_123",
      },
    });

    expect(constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_test_checkout"}',
      "sig_test_123",
      "whsec_test_123",
    );
    expect(retrievePaymentIntent).toHaveBeenCalledWith("pi_test_123", {
      expand: ["payment_method"],
    });
    expect(events).toEqual([
      {
        actions: [
          {
            data: {
              paymentMethod: {
                expiryMonth: 10,
                expiryYear: 2031,
                last4: "4242",
                providerMethodId: "pm_stripe_123",
                type: "card",
              },
              providerCustomerId: "cus_paykit_123",
            },
            type: "payment_method.upsert",
          },
        ],
        name: "payment_method.attached",
        payload: {
          paymentMethod: {
            expiryMonth: 10,
            expiryYear: 2031,
            last4: "4242",
            providerMethodId: "pm_stripe_123",
            type: "card",
          },
          providerCustomerId: "cus_paykit_123",
        },
      },
      {
        actions: [
          {
            data: {
              payment: {
                amount: 1999,
                createdAt: new Date("2025-03-07T00:00:00.000Z"),
                currency: "usd",
                description: "E2E checkout",
                metadata: {
                  source: "test",
                },
                providerMethodId: "pm_stripe_123",
                providerPaymentId: "pi_test_123",
                status: "succeeded",
              },
              providerCustomerId: "cus_paykit_123",
            },
            type: "payment.upsert",
          },
        ],
        name: "payment.succeeded",
        payload: {
          payment: {
            amount: 1999,
            createdAt: new Date("2025-03-07T00:00:00.000Z"),
            currency: "usd",
            description: "E2E checkout",
            metadata: {
              source: "test",
            },
            providerMethodId: "pm_stripe_123",
            providerPaymentId: "pi_test_123",
            status: "succeeded",
          },
          providerCustomerId: "cus_paykit_123",
        },
      },
      {
        name: "checkout.completed",
        payload: {
          checkoutSessionId: "cs_test_123",
          paymentStatus: "paid",
          providerCustomerId: "cus_paykit_123",
          providerEventId: "evt_test_checkout",
          status: "complete",
        },
      },
    ]);
  });

  it("should normalize setup checkout completion into an attached payment method event", async () => {
    const webhookEvent = {
      data: {
        object: {
          client_reference_id: "cus_paykit_123",
          customer: "cus_stripe_123",
          id: "cs_test_setup",
          mode: "setup",
          object: "checkout.session",
          payment_status: "no_payment_required",
          setup_intent: "seti_test_123",
          status: "complete",
        },
      },
      id: "evt_test_setup",
      type: "checkout.session.completed",
    } as StripeSdk.Event;

    const provider = createStripeProvider(
      createMockStripeClient({
        constructEvent: vi.fn(() => webhookEvent),
        createSession: vi.fn(),
        retrieveSetupIntent: vi.fn(async () => ({
          payment_method: {
            customer: "cus_stripe_123",
            id: "pm_stripe_setup",
            type: "link",
          },
        })),
      }),
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    const events = await provider.handleWebhook({
      body: "{}",
      headers: {
        "stripe-signature": "sig_test_123",
      },
    });

    expect(events).toEqual([
      {
        actions: [
          {
            data: {
              paymentMethod: {
                providerMethodId: "pm_stripe_setup",
                type: "link",
              },
              providerCustomerId: "cus_paykit_123",
            },
            type: "payment_method.upsert",
          },
        ],
        name: "payment_method.attached",
        payload: {
          paymentMethod: {
            providerMethodId: "pm_stripe_setup",
            type: "link",
          },
          providerCustomerId: "cus_paykit_123",
        },
      },
    ]);
  });

  it("should normalize detached payment-method webhooks", async () => {
    const webhookEvent = {
      data: {
        object: {
          id: "pm_stripe_detached",
          object: "payment_method",
          type: "card",
        },
      },
      id: "evt_test_detach",
      type: "payment_method.detached",
    } as StripeSdk.Event;

    const provider = createStripeProvider(
      createMockStripeClient({
        constructEvent: vi.fn(() => webhookEvent),
        createSession: vi.fn(),
      }),
      {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_123",
      },
    );

    const events = await provider.handleWebhook({
      body: "{}",
      headers: {
        "stripe-signature": "sig_test_123",
      },
    });

    expect(events).toEqual([
      {
        actions: [
          {
            data: {
              providerMethodId: "pm_stripe_detached",
            },
            type: "payment_method.delete",
          },
        ],
        name: "payment_method.detached",
        payload: {
          providerMethodId: "pm_stripe_detached",
        },
      },
    ]);
  });
});
