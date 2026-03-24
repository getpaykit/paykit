import { defineProvider } from "paykitjs";
import type { NormalizedWebhookEvent, PayKitEventError } from "paykitjs";
import StripeSdk from "stripe";

export interface StripeProviderOptions {
  secretKey: string;
  webhookSecret: string;
}

const PAYKIT_SOURCE_METADATA_KEY = "paykit_source";
const PAYKIT_PROVIDER_CUSTOMER_METADATA_KEY = "paykit_provider_customer_id";

function getStripeCustomerId(
  customer: string | StripeSdk.Customer | StripeSdk.DeletedCustomer | null,
): string | null {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function normalizeStripePaymentMethod(paymentMethod: StripeSdk.PaymentMethod): {
  expiryMonth?: number;
  expiryYear?: number;
  last4?: string;
  providerMethodId: string;
  type: string;
} {
  return {
    expiryMonth: paymentMethod.card?.exp_month ?? undefined,
    expiryYear: paymentMethod.card?.exp_year ?? undefined,
    last4: paymentMethod.card?.last4 ?? undefined,
    providerMethodId: paymentMethod.id,
    type: paymentMethod.type,
  };
}

function isPaymentMethodAttachedToCustomer(
  paymentMethod: StripeSdk.PaymentMethod,
  stripeCustomerId: string | null,
): boolean {
  if (!stripeCustomerId) {
    return false;
  }

  return getStripeCustomerId(paymentMethod.customer) === stripeCustomerId;
}

interface StripeCheckoutPaymentDetails {
  paymentIntent: StripeSdk.PaymentIntent | null;
  paymentMethod: StripeSdk.PaymentMethod | null;
}

function normalizeStripePaymentIntent(paymentIntent: StripeSdk.PaymentIntent): {
  amount: number;
  createdAt: Date;
  currency: string;
  description?: string | null;
  metadata?: Record<string, string>;
  providerMethodId?: string | null;
  providerPaymentId: string;
  status: string;
} {
  const providerMethodId =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id;

  return {
    amount: paymentIntent.amount_received || paymentIntent.amount,
    createdAt: new Date(paymentIntent.created * 1000),
    currency: paymentIntent.currency,
    description: paymentIntent.description,
    metadata: Object.keys(paymentIntent.metadata).length > 0 ? paymentIntent.metadata : undefined,
    providerMethodId,
    providerPaymentId: paymentIntent.id,
    status: paymentIntent.status,
  };
}

function createChargeMetadata(data: {
  metadata?: Record<string, string>;
  providerCustomerId: string;
}): Record<string, string> {
  return {
    [PAYKIT_PROVIDER_CUSTOMER_METADATA_KEY]: data.providerCustomerId,
    [PAYKIT_SOURCE_METADATA_KEY]: "charge",
    ...data.metadata,
  };
}

function getProviderCustomerIdFromPaymentIntent(
  paymentIntent: StripeSdk.PaymentIntent,
): string | null {
  return (
    paymentIntent.metadata[PAYKIT_PROVIDER_CUSTOMER_METADATA_KEY] ??
    getStripeCustomerId(paymentIntent.customer)
  );
}

function isPayKitDirectChargeIntent(paymentIntent: StripeSdk.PaymentIntent): boolean {
  return paymentIntent.metadata[PAYKIT_SOURCE_METADATA_KEY] === "charge";
}

function normalizeStripePaymentError(paymentIntent: StripeSdk.PaymentIntent): PayKitEventError {
  return {
    code: paymentIntent.last_payment_error?.code,
    message: paymentIntent.last_payment_error?.message ?? "Payment failed",
  };
}

async function getCheckoutPaymentDetails(
  client: StripeSdk,
  session: StripeSdk.Checkout.Session,
): Promise<StripeCheckoutPaymentDetails> {
  const stripeCustomerId = getStripeCustomerId(session.customer);
  if (!stripeCustomerId) {
    return {
      paymentIntent: null,
      paymentMethod: null,
    };
  }

  if (session.mode === "payment") {
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) {
      return {
        paymentIntent: null,
        paymentMethod: null,
      };
    }

    const paymentIntent = await client.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
    const paymentMethod = paymentIntent.payment_method;
    if (!paymentMethod || typeof paymentMethod === "string") {
      return {
        paymentIntent,
        paymentMethod: null,
      };
    }

    return {
      paymentIntent,
      paymentMethod: isPaymentMethodAttachedToCustomer(paymentMethod, stripeCustomerId)
        ? paymentMethod
        : null,
    };
  }

  if (session.mode === "setup") {
    const setupIntentId =
      typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
    if (!setupIntentId) {
      return {
        paymentIntent: null,
        paymentMethod: null,
      };
    }

    const setupIntent = await client.setupIntents.retrieve(setupIntentId, {
      expand: ["payment_method"],
    });
    const paymentMethod = setupIntent.payment_method;
    if (!paymentMethod || typeof paymentMethod === "string") {
      return {
        paymentIntent: null,
        paymentMethod: null,
      };
    }

    return {
      paymentIntent: null,
      paymentMethod: isPaymentMethodAttachedToCustomer(paymentMethod, stripeCustomerId)
        ? paymentMethod
        : null,
    };
  }

  return {
    paymentIntent: null,
    paymentMethod: null,
  };
}

async function createCheckoutCompletedEvents(
  client: StripeSdk,
  event: StripeSdk.Event,
): Promise<NormalizedWebhookEvent[]> {
  if (event.type !== "checkout.session.completed") {
    return [];
  }

  const session = event.data.object;
  const stripeCustomerId = getStripeCustomerId(session.customer);
  const providerCustomerId = session.client_reference_id ?? stripeCustomerId;
  if (!providerCustomerId) {
    return [];
  }

  const events: NormalizedWebhookEvent[] = [];
  const { paymentIntent, paymentMethod } = await getCheckoutPaymentDetails(client, session);
  if (paymentMethod) {
    const normalizedPaymentMethod = normalizeStripePaymentMethod(paymentMethod);
    events.push({
      actions: [
        {
          type: "payment_method.upsert",
          data: {
            paymentMethod: normalizedPaymentMethod,
            providerCustomerId,
          },
        },
      ],
      name: "payment_method.attached",
      payload: {
        paymentMethod: normalizedPaymentMethod,
        providerCustomerId,
      },
    });
  }

  if (session.mode === "payment") {
    if (paymentIntent?.status === "succeeded") {
      const normalizedPayment = normalizeStripePaymentIntent(paymentIntent);
      events.push({
        actions: [
          {
            data: {
              payment: normalizedPayment,
              providerCustomerId,
            },
            type: "payment.upsert",
          },
        ],
        name: "payment.succeeded",
        payload: {
          payment: normalizedPayment,
          providerCustomerId,
        },
      });
    }

    events.push({
      name: "checkout.completed",
      payload: {
        checkoutSessionId: session.id,
        paymentStatus: session.payment_status,
        providerCustomerId,
        providerEventId: event.id,
        status: session.status,
      },
    });
  }

  return events;
}

function createDetachedPaymentMethodEvents(event: StripeSdk.Event): NormalizedWebhookEvent[] {
  if (event.type !== "payment_method.detached") {
    return [];
  }

  const paymentMethod = event.data.object;

  return [
    {
      actions: [
        {
          type: "payment_method.delete",
          data: {
            providerMethodId: paymentMethod.id,
          },
        },
      ],
      name: "payment_method.detached",
      payload: {
        providerMethodId: paymentMethod.id,
      },
    },
  ];
}

function createDirectChargeSucceededEvents(event: StripeSdk.Event): NormalizedWebhookEvent[] {
  if (event.type !== "payment_intent.succeeded") {
    return [];
  }

  const paymentIntent = event.data.object;
  if (!isPayKitDirectChargeIntent(paymentIntent)) {
    return [];
  }

  const providerCustomerId = getProviderCustomerIdFromPaymentIntent(paymentIntent);
  if (!providerCustomerId) {
    return [];
  }

  const normalizedPayment = normalizeStripePaymentIntent(paymentIntent);
  return [
    {
      actions: [
        {
          data: {
            payment: normalizedPayment,
            providerCustomerId,
          },
          type: "payment.upsert",
        },
      ],
      name: "payment.succeeded",
      payload: {
        payment: normalizedPayment,
        providerCustomerId,
      },
    },
  ];
}

function createDirectChargeFailedEvents(event: StripeSdk.Event): NormalizedWebhookEvent[] {
  if (event.type !== "payment_intent.payment_failed") {
    return [];
  }

  const paymentIntent = event.data.object;
  if (!isPayKitDirectChargeIntent(paymentIntent)) {
    return [];
  }

  const providerCustomerId = getProviderCustomerIdFromPaymentIntent(paymentIntent);
  if (!providerCustomerId) {
    return [];
  }

  const normalizedPayment = normalizeStripePaymentIntent(paymentIntent);
  return [
    {
      actions: [
        {
          data: {
            payment: normalizedPayment,
            providerCustomerId,
          },
          type: "payment.upsert",
        },
      ],
      name: "payment.failed",
      payload: {
        error: normalizeStripePaymentError(paymentIntent),
        payment: normalizedPayment,
        providerCustomerId,
      },
    },
  ];
}

export function createStripeProvider(client: StripeSdk, options: StripeProviderOptions) {
  const currency = "usd";

  return defineProvider({
    id: "stripe",

    async upsertCustomer(data) {
      const customer = await client.customers.create({
        email: data.email,
        metadata: {
          customerId: data.id,
          ...data.metadata,
        },
        name: data.name,
      });

      return { providerCustomerId: customer.id };
    },

    async checkout(data) {
      const session = await client.checkout.sessions.create({
        customer: data.providerCustomerId,
        line_items: [{ price: data.providerPriceId, quantity: 1 }],
        mode: data.mode,
        success_url: data.successUrl,
        cancel_url: data.cancelUrl ?? data.successUrl,
        metadata: data.metadata,
      });

      if (!session.url) {
        throw new Error("Stripe Checkout session did not include a URL.");
      }

      return { url: session.url };
    },

    async attachPaymentMethod(data) {
      const session = await client.checkout.sessions.create({
        cancel_url: data.returnURL,
        client_reference_id: data.providerCustomerId,
        customer: data.providerCustomerId,
        mode: "setup",
        success_url: data.returnURL,
      });

      if (!session.url) {
        throw new Error("Stripe setup session did not include a URL.");
      }

      return { url: session.url };
    },

    async detachPaymentMethod(data) {
      await client.paymentMethods.detach(data.providerMethodId);
    },

    async charge(data) {
      const paymentIntent = await client.paymentIntents.create({
        amount: data.amount,
        confirm: true,
        currency,
        customer: data.providerCustomerId,
        description: data.description,
        metadata: createChargeMetadata(data),
        off_session: true,
        payment_method: data.providerMethodId,
      });

      return normalizeStripePaymentIntent(paymentIntent);
    },

    async syncProduct(data) {
      let providerProductId = data.existingProviderProductId;
      if (!providerProductId) {
        const stripeProduct = await client.products.create({
          name: data.name,
          metadata: { paykit_product_id: data.id },
        });
        providerProductId = stripeProduct.id;
      } else {
        await client.products.update(providerProductId, { name: data.name });
      }

      if (data.existingProviderPriceId) {
        return { providerProductId, providerPriceId: data.existingProviderPriceId };
      }

      const priceParams: StripeSdk.PriceCreateParams = {
        product: providerProductId,
        unit_amount: data.priceAmount,
        currency,
      };
      if (data.priceInterval) {
        priceParams.recurring = {
          interval: data.priceInterval as "month" | "year",
        };
      }
      const stripePrice = await client.prices.create(priceParams);

      return { providerProductId, providerPriceId: stripePrice.id };
    },

    async handleWebhook(data) {
      const signature = data.headers["stripe-signature"];
      if (!signature) {
        throw new Error("Missing Stripe signature header.");
      }

      const event = client.webhooks.constructEvent(data.body, signature, options.webhookSecret);
      return [
        ...(await createCheckoutCompletedEvents(client, event)),
        ...createDirectChargeSucceededEvents(event),
        ...createDirectChargeFailedEvents(event),
        ...createDetachedPaymentMethodEvents(event),
      ];
    },
  });
}

export function stripe(options: StripeProviderOptions) {
  return createStripeProvider(new StripeSdk(options.secretKey), options);
}
