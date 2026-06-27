import StripeSdk from "stripe";

import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { PaymentProvider, ProviderTestClock } from "../providers/provider";
import type { NormalizedWebhookEvent } from "../types/events";
import { DEFAULT_STRIPE_CURRENCY, getStripeCurrency, type StripeCurrency } from "./currency";

/**
 * Stripe API version PayKit is tested against. Users can override via
 * `createPayKit({ stripe: { apiVersion } })`, e.g. to opt into preview features.
 */
export const PAYKIT_STRIPE_API_VERSION = "2025-10-29.clover";

const STRIPE_MANAGED_PAYMENTS_MIN_VERSION = "2026-03-04.preview";
const STRIPE_WEBHOOK_EVENTS: StripeSdk.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.created",
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.updated",
  "payment_method.detached",
];

export interface StripeOptions {
  secretKey: string;
  webhookSecret: string;
  /**
   * Currency used for new Stripe prices and PayKit-created invoices.
   * @default "usd"
   */
  currency?: StripeCurrency;
  /** Override the Stripe API version (e.g. for preview features). */
  apiVersion?: string;
  /** Enable Stripe Managed Payments (requires a preview API version). */
  managedPayments?: boolean;
}

type StripeAdapterOptions = Omit<StripeOptions, "webhookSecret"> & {
  webhookSecret?: string;
};

type StripeInvoiceWithExtras = StripeSdk.Invoice & {
  payment_intent?: StripeSdk.PaymentIntent | string | null;
  subscription?: StripeSdk.Subscription | string | null;
};

type StripeSubscriptionWithExtras = StripeSdk.Subscription & {
  latest_invoice?: StripeInvoiceWithExtras | string | null;
};

function toDate(value?: number | null): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getLatestPeriodEnd(subscription: StripeSubscriptionWithExtras): number | null {
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    const subscriptionWithPeriod = subscription as { current_period_end?: number | null };
    return subscriptionWithPeriod.current_period_end ?? null;
  }

  return subscription.items.data.reduce((latest, item) => {
    return Math.max(latest, item.current_period_end);
  }, firstItem.current_period_end);
}

function getEarliestPeriodStart(subscription: StripeSubscriptionWithExtras): number | null {
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    const subscriptionWithPeriod = subscription as { current_period_start?: number | null };
    return subscriptionWithPeriod.current_period_start ?? null;
  }

  return subscription.items.data.reduce((earliest, item) => {
    return Math.min(earliest, item.current_period_start);
  }, firstItem.current_period_start);
}

function getStripeCustomerId(
  customer: string | StripeSdk.Customer | StripeSdk.DeletedCustomer | null,
): string | null {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function parseUnsignedStripeEvent(body: string): StripeSdk.Event {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { id?: unknown }).id !== "string" ||
    typeof (parsed as { type?: unknown }).type !== "string"
  ) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID);
  }

  return parsed as StripeSdk.Event;
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

function normalizeStripePaymentIntent(paymentIntent: StripeSdk.PaymentIntent) {
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

function normalizeStripeInvoice(invoice: StripeInvoiceWithExtras) {
  return {
    currency: invoice.currency,
    hostedUrl: invoice.hosted_invoice_url,
    periodEndAt: toDate(invoice.period_end),
    periodStartAt: toDate(invoice.period_start),
    providerInvoiceId: invoice.id,
    status: invoice.status,
    totalAmount: invoice.total ?? 0,
  };
}

function normalizeStripeSubscription(subscription: StripeSubscriptionWithExtras) {
  const firstItem = subscription.items.data[0];
  const price = firstItem?.price;
  const providerPriceId = typeof price === "string" ? price : price?.id;
  const providerProductId =
    price && typeof price !== "string"
      ? typeof price.product === "string"
        ? price.product
        : (price.product?.id ?? null)
      : null;
  const periodStart = getEarliestPeriodStart(subscription);
  const periodEnd = getLatestPeriodEnd(subscription);

  let providerProduct: Record<string, string> | null = null;
  if (providerPriceId && providerProductId) {
    providerProduct = { priceId: providerPriceId, productId: providerProductId };
  } else if (providerPriceId) {
    providerProduct = { priceId: providerPriceId };
  }

  const cancelAt = (subscription as { cancel_at?: number | null }).cancel_at;
  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end || (cancelAt != null && cancelAt > 0),
    canceledAt: toDate(subscription.canceled_at),
    currentPeriodEndAt: toDate(periodEnd),
    currentPeriodStartAt: toDate(periodStart),
    endedAt: toDate(subscription.ended_at),
    providerProduct,
    providerSubscriptionId: subscription.id,
    providerSubscriptionScheduleId:
      (typeof subscription.schedule === "string"
        ? subscription.schedule
        : subscription.schedule?.id) ?? null,
    quantity: firstItem?.quantity ?? 1,
    status: subscription.status,
  };
}

function normalizeStripeTestClock(clock: StripeSdk.TestHelpers.TestClock): ProviderTestClock {
  return {
    frozenTime: new Date(clock.frozen_time * 1000),
    id: clock.id,
    name: clock.name ?? null,
    status: clock.status,
  };
}

function assertStripeTestKey(options: Pick<StripeOptions, "secretKey">): void {
  if (!options.secretKey.startsWith("sk_test_")) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_TEST_KEY_REQUIRED);
  }
}

function getStripeEnvironment(secretKey: string): string {
  return secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_") ? "test" : "live";
}

function getStripeDisplayName(account: StripeSdk.Account): string {
  return account.settings?.dashboard?.display_name || account.business_profile?.name || account.id;
}

function isStripeResourceMissingError(error: unknown): boolean {
  if (!(error instanceof StripeSdk.errors.StripeError)) {
    return false;
  }

  return (
    error.type === "StripeInvalidRequestError" &&
    error.code === "resource_missing" &&
    error.statusCode === 404
  );
}

async function retrieveExpandedSubscription(
  client: StripeSdk,
  providerSubscriptionId: string,
): Promise<StripeSubscriptionWithExtras> {
  return (await client.subscriptions.retrieve(providerSubscriptionId, {
    expand: ["items.data.price", "latest_invoice.payment_intent", "schedule"],
  })) as StripeSubscriptionWithExtras;
}

function normalizeRequiredAction(paymentIntent?: StripeSdk.PaymentIntent | null) {
  const nextActionType = paymentIntent?.next_action?.type;
  if (!nextActionType) {
    return null;
  }

  return {
    clientSecret: paymentIntent.client_secret ?? undefined,
    paymentIntentId: paymentIntent.id,
    type: nextActionType,
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

async function getCheckoutPaymentDetails(client: StripeSdk, session: StripeSdk.Checkout.Session) {
  const stripeCustomerId = getStripeCustomerId(session.customer);
  if (!stripeCustomerId) {
    return {
      paymentIntent: null,
      paymentMethod: null,
    };
  }

  if (session.mode === "payment" || session.mode === "subscription") {
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (paymentIntentId) {
      const paymentIntent = await client.paymentIntents.retrieve(paymentIntentId, {
        expand: ["payment_method"],
      });
      const paymentMethod = paymentIntent.payment_method;
      if (paymentMethod && typeof paymentMethod !== "string") {
        return {
          paymentIntent,
          paymentMethod: isPaymentMethodAttachedToCustomer(paymentMethod, stripeCustomerId)
            ? paymentMethod
            : null,
        };
      }
    }

    // Subscription-mode checkouts don't have a top-level payment_intent.
    // Retrieve the payment method from the subscription's default_payment_method.
    if (session.mode === "subscription") {
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        const sub = await client.subscriptions.retrieve(subscriptionId, {
          expand: ["default_payment_method"],
        });
        const paymentMethod = sub.default_payment_method;
        if (paymentMethod && typeof paymentMethod !== "string") {
          return {
            paymentIntent: null,
            paymentMethod: isPaymentMethodAttachedToCustomer(paymentMethod, stripeCustomerId)
              ? paymentMethod
              : null,
          };
        }
      }
    }

    return {
      paymentIntent: null,
      paymentMethod: null,
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
  const providerSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const providerInvoiceId =
    typeof session.invoice === "string" ? session.invoice : (session.invoice?.id ?? null);
  const expandedSubscription =
    session.mode === "subscription" && providerSubscriptionId
      ? await retrieveExpandedSubscription(client, providerSubscriptionId)
      : null;
  const expandedInvoice =
    providerInvoiceId != null
      ? ((await client.invoices.retrieve(providerInvoiceId, {
          expand: ["payment_intent"],
        })) as StripeInvoiceWithExtras)
      : null;

  if (paymentMethod) {
    const normalizedPaymentMethod = {
      ...normalizeStripePaymentMethod(paymentMethod),
      isDefault: session.mode === "subscription",
    };
    events.push({
      actions: [
        {
          data: {
            paymentMethod: normalizedPaymentMethod,
            providerCustomerId,
          },
          type: "payment_method.upsert",
        },
      ],
      name: "payment_method.attached",
      payload: {
        paymentMethod: normalizedPaymentMethod,
        providerCustomerId,
      },
    });
  }

  if (session.mode === "payment" && paymentIntent?.status === "succeeded") {
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

  const sessionMetadata = session.metadata ?? {};

  events.push({
    name: "checkout.completed",
    payload: {
      checkoutSessionId: session.id,
      invoice: expandedInvoice ? normalizeStripeInvoice(expandedInvoice) : undefined,
      metadata: Object.keys(sessionMetadata).length > 0 ? sessionMetadata : undefined,
      mode: session.mode ?? undefined,
      paymentStatus: session.payment_status,
      providerCustomerId,
      providerEventId: event.id,
      providerInvoiceId: providerInvoiceId ?? undefined,
      providerSubscriptionId: providerSubscriptionId ?? undefined,
      status: session.status,
      subscription: expandedSubscription
        ? normalizeStripeSubscription(expandedSubscription)
        : undefined,
    },
  });

  return events;
}

async function createSubscriptionEvents(event: StripeSdk.Event): Promise<NormalizedWebhookEvent[]> {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return [];
  }

  const sourceSubscription = event.data.object as StripeSubscriptionWithExtras;

  // Use the webhook event's subscription data directly. Re-fetching from
  // Stripe can return stale data during renewals (period dates not yet
  // propagated). The webhook event is the authoritative source.
  const subscription = sourceSubscription;
  const providerCustomerId = getStripeCustomerId(subscription.customer);
  if (!providerCustomerId) {
    return [];
  }

  if (event.type === "customer.subscription.deleted") {
    return [
      {
        actions: [
          {
            data: {
              providerCustomerId,
              providerSubscriptionId: subscription.id,
            },
            type: "subscription.delete",
          },
        ],
        name: "subscription.deleted",
        payload: {
          providerCustomerId,
          providerEventId: event.id,
          providerSubscriptionId: subscription.id,
        },
      },
    ];
  }

  const normalizedSubscription = normalizeStripeSubscription(subscription);
  const normalizedEvent: NormalizedWebhookEvent<"subscription.updated"> = {
    actions: [
      {
        data: {
          providerCustomerId,
          subscription: normalizedSubscription,
        },
        type: "subscription.upsert",
      },
    ],
    name: "subscription.updated",
    payload: {
      providerCustomerId,
      providerEventId: event.id,
      subscription: normalizedSubscription,
    },
  };
  return [normalizedEvent];
}

function createInvoiceEvents(event: StripeSdk.Event): NormalizedWebhookEvent[] {
  if (
    event.type !== "invoice.created" &&
    event.type !== "invoice.finalized" &&
    event.type !== "invoice.paid" &&
    event.type !== "invoice.payment_failed" &&
    event.type !== "invoice.updated"
  ) {
    return [];
  }

  const invoice = event.data.object as StripeInvoiceWithExtras;
  const providerCustomerId = getStripeCustomerId(invoice.customer);
  if (!providerCustomerId) {
    return [];
  }

  const providerSubscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);

  const normalizedInvoice = normalizeStripeInvoice(invoice);
  const normalizedEvent: NormalizedWebhookEvent<"invoice.updated"> = {
    actions: [
      {
        data: {
          invoice: normalizedInvoice,
          providerCustomerId,
          providerSubscriptionId,
        },
        type: "invoice.upsert",
      },
    ],
    name: "invoice.updated",
    payload: {
      invoice: normalizedInvoice,
      providerCustomerId,
      providerEventId: event.id,
      providerSubscriptionId,
    },
  };
  return [normalizedEvent];
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
          data: {
            providerMethodId: paymentMethod.id,
          },
          type: "payment_method.delete",
        },
      ],
      name: "payment_method.detached",
      payload: {
        providerEventId: event.id,
        providerMethodId: paymentMethod.id,
      },
    },
  ];
}

export function createStripeProvider(
  client: StripeSdk,
  options: StripeAdapterOptions,
): PaymentProvider {
  const currency = getStripeCurrency(options);

  return {
    id: "stripe",
    name: "Stripe",

    async createCustomer(data) {
      let testClock: ProviderTestClock | undefined;
      if (data.createTestClock) {
        assertStripeTestKey(options);
        const clock = await client.testHelpers.testClocks.create({
          frozen_time: Math.floor(Date.now() / 1000),
          name: data.id,
        });
        testClock = normalizeStripeTestClock(clock);
      }

      const customer = await client.customers.create({
        email: data.email,
        metadata: {
          customerId: data.id,
          ...data.metadata,
        },
        name: data.name,
        test_clock: testClock?.id,
      });

      return {
        providerCustomer: {
          id: customer.id,
          frozenTime: testClock?.frozenTime.toISOString(),
          testClockId: testClock?.id,
        },
      };
    },

    async updateCustomer(data) {
      await client.customers.update(data.providerCustomerId, {
        email: data.email,
        metadata: data.metadata,
        name: data.name,
      });
    },

    async deleteCustomer(data) {
      await client.customers.del(data.providerCustomerId);
    },

    async getTestClock(data) {
      const clock = await client.testHelpers.testClocks.retrieve(data.testClockId);
      return normalizeStripeTestClock(clock);
    },

    async advanceTestClock(data) {
      assertStripeTestKey(options);

      await client.testHelpers.testClocks.advance(data.testClockId, {
        frozen_time: Math.floor(data.frozenTime.getTime() / 1000),
      });

      for (let i = 0; i < 60; i++) {
        const clock = await client.testHelpers.testClocks.retrieve(data.testClockId);
        if (clock.status === "ready") {
          return normalizeStripeTestClock(clock);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new Error(`Test clock ${data.testClockId} did not reach 'ready' status`);
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
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return { url: session.url };
    },

    async createSubscriptionCheckout(data) {
      const sessionParams: StripeSdk.Checkout.SessionCreateParams & {
        managed_payments?: { enabled: boolean };
      } = {
        allow_promotion_codes: data.checkout?.allowPromotionCodes,
        automatic_tax: data.checkout?.automaticTax,
        billing_address_collection: data.checkout?.billingAddressCollection,
        cancel_url: data.cancelUrl ?? data.successUrl,
        client_reference_id: data.providerCustomerId,
        customer: data.providerCustomerId,
        customer_update: data.checkout?.customerUpdate,
        line_items: [{ price: data.providerProduct.priceId, quantity: data.quantity }],
        metadata: data.metadata,
        mode: "subscription",
        subscription_data: data.metadata ? { metadata: data.metadata } : undefined,
        success_url: data.successUrl,
        tax_id_collection: data.checkout?.taxIdCollection,
      };
      if (options.managedPayments) {
        sessionParams.managed_payments = { enabled: true };
      }
      const requestOptions = data.checkout?.idempotencyKey
        ? { idempotencyKey: data.checkout.idempotencyKey }
        : undefined;
      const session = requestOptions
        ? await client.checkout.sessions.create(sessionParams, requestOptions)
        : await client.checkout.sessions.create(sessionParams);

      if (!session.url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: session.url,
        providerCheckoutSessionId: session.id,
      };
    },

    async expireCheckoutSession(data) {
      let session: StripeSdk.Checkout.Session;
      try {
        session = await client.checkout.sessions.retrieve(data.providerCheckoutSessionId);
      } catch (error) {
        if (isStripeResourceMissingError(error)) {
          throw PayKitError.from(
            "NOT_FOUND",
            PAYKIT_ERROR_CODES.PROVIDER_CHECKOUT_SESSION_NOT_FOUND,
          );
        }
        throw error;
      }

      const sessionCustomerId = getStripeCustomerId(session.customer);
      const isCustomerSession =
        sessionCustomerId === data.providerCustomerId ||
        session.client_reference_id === data.providerCustomerId;
      if (!isCustomerSession) {
        throw PayKitError.from(
          "FORBIDDEN",
          PAYKIT_ERROR_CODES.PROVIDER_CHECKOUT_SESSION_CUSTOMER_MISMATCH,
        );
      }

      if (session.status === "expired") {
        return {
          providerCheckoutSessionId: session.id,
          status: "expired",
        };
      }

      if (session.status !== "open") {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_CHECKOUT_SESSION_NOT_EXPIREABLE,
        );
      }

      const expiredSession = await client.checkout.sessions.expire(data.providerCheckoutSessionId);
      if (expiredSession.status !== "expired") {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_CHECKOUT_SESSION_NOT_EXPIREABLE,
        );
      }

      return {
        providerCheckoutSessionId: expiredSession.id,
        status: "expired",
      };
    },

    async createSubscription(data) {
      const createParams: StripeSdk.SubscriptionCreateParams = {
        customer: data.providerCustomerId,
        items: [{ price: data.providerProduct.priceId, quantity: data.quantity }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      };
      const createdSubscription = (await client.subscriptions.create(
        createParams,
      )) as StripeSubscriptionWithExtras;

      const latestInvoice = createdSubscription.latest_invoice;
      const invoice =
        latestInvoice && typeof latestInvoice !== "string"
          ? normalizeStripeInvoice(latestInvoice)
          : null;
      const paymentIntent =
        latestInvoice && typeof latestInvoice !== "string"
          ? (latestInvoice.payment_intent as StripeSdk.PaymentIntent | null | undefined)
          : null;

      return {
        invoice,
        paymentUrl: null,
        requiredAction: normalizeRequiredAction(paymentIntent ?? null),
        subscription: normalizeStripeSubscription(createdSubscription),
      };
    },

    async updateSubscription(data) {
      const currentSubscription = await retrieveExpandedSubscription(
        client,
        data.providerSubscriptionId,
      );
      const currentItem = currentSubscription.items.data[0];
      if (!currentItem) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SUBSCRIPTION_MISSING_ITEMS,
        );
      }

      const updatedSubscription = (await client.subscriptions.update(data.providerSubscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: data.providerProduct.priceId,
            quantity: data.quantity,
          },
        ],
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        expand: ["latest_invoice.payment_intent"],
      })) as StripeSubscriptionWithExtras;

      const latestInvoice = updatedSubscription.latest_invoice;
      const invoice =
        latestInvoice && typeof latestInvoice !== "string"
          ? normalizeStripeInvoice(latestInvoice)
          : null;
      const paymentIntent =
        latestInvoice && typeof latestInvoice !== "string"
          ? (latestInvoice.payment_intent as StripeSdk.PaymentIntent | null | undefined)
          : null;

      return {
        invoice,
        paymentUrl: null,
        requiredAction: normalizeRequiredAction(paymentIntent ?? null),
        subscription: normalizeStripeSubscription(updatedSubscription),
      };
    },

    async scheduleSubscriptionChange(data) {
      if (!data.providerProduct?.priceId) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_PRICE_REQUIRED);
      }

      const currentSub = (await client.subscriptions.retrieve(data.providerSubscriptionId, {
        expand: ["items"],
      })) as StripeSubscriptionWithExtras;
      const periodEndSeconds = getLatestPeriodEnd(currentSub);
      if (typeof periodEndSeconds !== "number") {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SUBSCRIPTION_MISSING_PERIOD,
        );
      }

      const currentItems = currentSub.items.data.map(
        (item: { price: { id: string }; quantity?: number | null }) => ({
          price: item.price.id,
          quantity: item.quantity ?? 1,
        }),
      );

      let schedule: StripeSdk.SubscriptionSchedule;
      if (data.providerSubscriptionScheduleId) {
        schedule = await client.subscriptionSchedules.retrieve(data.providerSubscriptionScheduleId);
      } else {
        const existingScheduleId =
          typeof currentSub.schedule === "string"
            ? currentSub.schedule
            : (currentSub.schedule?.id ?? null);
        schedule = existingScheduleId
          ? await client.subscriptionSchedules.retrieve(existingScheduleId)
          : await client.subscriptionSchedules.create({
              from_subscription: data.providerSubscriptionId,
            });
      }
      const scheduleId = schedule.id;

      const currentPhase = schedule.phases[0];
      const currentPhaseStart = currentPhase?.start_date ?? Math.floor(Date.now() / 1000);

      await client.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          {
            items: currentItems,
            start_date: currentPhaseStart,
            end_date: periodEndSeconds,
          },
          {
            items: [{ price: data.providerProduct.priceId, quantity: data.quantity }],
            start_date: periodEndSeconds,
          },
        ],
      });

      const updatedSubscription = await retrieveExpandedSubscription(
        client,
        data.providerSubscriptionId,
      );

      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: normalizeStripeSubscription(updatedSubscription),
      };
    },

    async cancelSubscription(data) {
      const currentSubscription = (await client.subscriptions.retrieve(
        data.providerSubscriptionId,
      )) as StripeSubscriptionWithExtras;

      let scheduleId = data.providerSubscriptionScheduleId ?? null;
      if (!scheduleId) {
        scheduleId =
          typeof currentSubscription.schedule === "string"
            ? currentSubscription.schedule
            : (currentSubscription.schedule?.id ?? null);
      }
      if (scheduleId) {
        const schedule = await client.subscriptionSchedules.retrieve(scheduleId);
        if (schedule.status !== "released" && schedule.status !== "canceled") {
          await client.subscriptionSchedules.release(scheduleId);
        }
      }

      const updatedSubscription = (await client.subscriptions.update(data.providerSubscriptionId, {
        cancel_at_period_end: true,
      })) as StripeSubscriptionWithExtras;

      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: normalizeStripeSubscription(updatedSubscription),
      };
    },

    async listActiveSubscriptions(data) {
      const subscriptions = await client.subscriptions.list({
        customer: data.providerCustomerId,
        status: "active",
      });
      return subscriptions.data.map((sub) => ({
        providerSubscriptionId: sub.id,
      }));
    },

    async resumeSubscription(data) {
      let scheduleId = data.providerSubscriptionScheduleId ?? null;
      if (!scheduleId) {
        const sub = await client.subscriptions.retrieve(data.providerSubscriptionId);
        scheduleId = typeof sub.schedule === "string" ? sub.schedule : (sub.schedule?.id ?? null);
      }
      if (scheduleId) {
        const schedule = await client.subscriptionSchedules.retrieve(scheduleId);
        if (schedule.status !== "released" && schedule.status !== "canceled") {
          await client.subscriptionSchedules.release(scheduleId);
        }
      }

      const updatedSubscription = (await client.subscriptions.update(data.providerSubscriptionId, {
        cancel_at_period_end: false,
      })) as StripeSubscriptionWithExtras;

      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: normalizeStripeSubscription(updatedSubscription),
      };
    },

    async detachPaymentMethod(data) {
      await client.paymentMethods.detach(data.providerMethodId);
    },

    async syncProducts(data) {
      const results = await Promise.all(
        data.products.map(async (product) => {
          let productId = product.existingProviderProduct?.productId ?? null;
          if (!productId) {
            const stripeProduct = await client.products.create({
              metadata: { paykit_product_id: product.id },
              name: product.name,
            });
            productId = stripeProduct.id;
          } else {
            await client.products.update(productId, { name: product.name });
          }

          const existingPriceId = product.existingProviderProduct?.priceId ?? null;
          if (existingPriceId) {
            return { id: product.id, providerProduct: { productId, priceId: existingPriceId } };
          }

          const priceParams: StripeSdk.PriceCreateParams = {
            currency: product.priceCurrency,
            product: productId,
            unit_amount: product.priceAmount,
          };
          if (product.priceInterval) {
            priceParams.recurring = {
              interval: product.priceInterval as "month" | "year",
            };
          }
          const stripePrice = await client.prices.create(priceParams);

          return { id: product.id, providerProduct: { productId, priceId: stripePrice.id } };
        }),
      );

      return { results };
    },

    async createInvoice(data) {
      const stripeInvoice = await client.invoices.create({
        auto_advance: data.autoAdvance ?? true,
        collection_method: "charge_automatically",
        customer: data.providerCustomerId,
        currency,
      });

      if (data.lines.length > 0) {
        await client.invoices.addLines(stripeInvoice.id, {
          lines: data.lines.map((line) => ({
            amount: line.amount,
            description: line.description,
          })),
        });
      }

      const finalizedInvoice = await client.invoices.finalizeInvoice(stripeInvoice.id);

      return normalizeStripeInvoice(finalizedInvoice);
    },

    async handleWebhook(data) {
      const headerKey = Object.keys(data.headers).find(
        (k) => k.toLowerCase() === "stripe-signature",
      );
      const signature = headerKey ? data.headers[headerKey] : undefined;

      const event = data.allowUnsignedPayload
        ? parseUnsignedStripeEvent(data.body)
        : await (async () => {
            if (!signature) {
              throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING);
            }
            if (!options.webhookSecret) {
              throw PayKitError.from(
                "BAD_REQUEST",
                PAYKIT_ERROR_CODES.PROVIDER_INVALID_CONFIG,
                "Stripe webhookSecret is required to verify signed webhook payloads.",
              );
            }
            return client.webhooks.constructEventAsync(data.body, signature, options.webhookSecret);
          })();
      return [
        ...(await createCheckoutCompletedEvents(client, event)),
        ...(await createSubscriptionEvents(event)),
        ...createInvoiceEvents(event),
        ...createDetachedPaymentMethodEvents(event),
      ];
    },

    async getTunnelAccount() {
      const account = await client.accounts.retrieve();
      const displayName = getStripeDisplayName(account);
      return {
        displayName,
        environment: getStripeEnvironment(options.secretKey),
        providerAccountId: account.id,
        providerId: "stripe",
      };
    },

    async ensureTunnelWebhook(data) {
      if (data.existingEndpointId) {
        try {
          const endpoint = await client.webhookEndpoints.update(data.existingEndpointId, {
            enabled_events: STRIPE_WEBHOOK_EVENTS,
            url: data.url,
          });
          return {
            created: false,
            endpointId: endpoint.id,
            webhookSecret: options.webhookSecret || undefined,
          };
        } catch (error) {
          if (!isStripeResourceMissingError(error)) {
            throw error;
          }

          // Fall through to create a fresh endpoint when the stored one no longer exists.
        }
      }

      const endpoint = await client.webhookEndpoints.create({
        enabled_events: STRIPE_WEBHOOK_EVENTS,
        url: data.url,
      });

      return {
        created: true,
        endpointId: endpoint.id,
        webhookSecret: endpoint.secret ?? undefined,
      };
    },

    async disableTunnelWebhook(data) {
      await client.webhookEndpoints.del(data.endpointId);
    },

    async createPortalSession(data) {
      const session = await client.billingPortal.sessions.create({
        customer: data.providerCustomerId,
        return_url: data.returnUrl,
      });
      return { url: session.url };
    },

    async check() {
      const mode = getStripeEnvironment(options.secretKey) === "test" ? "test mode" : "live mode";
      try {
        const account = await client.accounts.retrieve();
        const displayName = getStripeDisplayName(account);

        let webhookEndpoints: Array<{ url: string; status: string }> = [];
        try {
          const endpoints = await client.webhookEndpoints.list({ limit: 100 });
          webhookEndpoints = endpoints.data
            .filter((ep) => ep.status === "enabled")
            .map((ep) => ({ url: ep.url, status: ep.status }));
        } catch {
          // webhook listing may fail with restricted keys
        }

        return { ok: true, displayName, mode, webhookEndpoints };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, displayName: "unknown", mode, error: message };
      }
    },
  };
}

export function createStripeAdapter(options: StripeAdapterOptions): PaymentProvider {
  const optionsWithDefaults = { ...options, currency: options.currency ?? DEFAULT_STRIPE_CURRENCY };
  const apiVersion = options.apiVersion ?? PAYKIT_STRIPE_API_VERSION;
  if (options.managedPayments) {
    if (!apiVersion.endsWith(".preview") || apiVersion < STRIPE_MANAGED_PAYMENTS_MIN_VERSION) {
      throw PayKitError.from(
        "BAD_REQUEST",
        PAYKIT_ERROR_CODES.PROVIDER_INVALID_CONFIG,
        `managedPayments requires apiVersion >= ${STRIPE_MANAGED_PAYMENTS_MIN_VERSION} (got "${apiVersion}")`,
      );
    }
  }
  const client = new StripeSdk(options.secretKey, {
    apiVersion: apiVersion as StripeSdk.LatestApiVersion,
    maxNetworkRetries: 3,
  });

  return createStripeProvider(client, optionsWithDefaults);
}
