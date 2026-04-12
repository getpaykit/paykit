import StripeSdk from "stripe";

import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import type { NormalizedWebhookEvent } from "../types/events";
import { getStripeRecurringInterval, type PlanInterval } from "../types/interval";
import type { ProviderTestClock, StripeProviderConfig, StripeRuntime } from "./provider";

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
  const providerPriceId =
    typeof firstItem?.price === "string" ? firstItem.price : firstItem?.price.id;
  const periodStart = getEarliestPeriodStart(subscription);
  const periodEnd = getLatestPeriodEnd(subscription);

  const cancelAt = (subscription as { cancel_at?: number | null }).cancel_at;
  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end || (cancelAt != null && cancelAt > 0),
    canceledAt: toDate(subscription.canceled_at),
    currentPeriodEndAt: toDate(periodEnd),
    currentPeriodStartAt: toDate(periodStart),
    endedAt: toDate(subscription.ended_at),
    providerPriceId: providerPriceId ?? null,
    providerSubscriptionId: subscription.id,
    providerSubscriptionScheduleId:
      (typeof subscription.schedule === "string"
        ? subscription.schedule
        : subscription.schedule?.id) ?? null,
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

function assertStripeTestKey(options: StripeProviderConfig): void {
  if (!options.secretKey.startsWith("sk_test_")) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_TEST_KEY_REQUIRED);
  }
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
  options: StripeProviderConfig,
): StripeRuntime {
  const currency = options.currency ?? "usd";

  return {
    async upsertCustomer(data) {
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
      const sessionParams: StripeSdk.Checkout.SessionCreateParams = {
        cancel_url: data.cancelUrl ?? data.successUrl,
        client_reference_id: data.providerCustomerId,
        customer: data.providerCustomerId,
        line_items: [{ price: data.providerPriceId, quantity: 1 }],
        metadata: data.metadata,
        mode: "subscription",
        success_url: data.successUrl,
      };
      const session = await client.checkout.sessions.create(sessionParams);

      if (!session.url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: session.url,
        providerCheckoutSessionId: session.id,
      };
    },

    async createSubscription(data) {
      const createParams: StripeSdk.SubscriptionCreateParams = {
        customer: data.providerCustomerId,
        items: [{ price: data.providerPriceId }],
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
            price: data.providerPriceId,
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
      if (!data.providerPriceId) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_PRICE_REQUIRED);
      }

      // Fetch the current subscription to get the current price and period end.
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

      const currentItems = currentSub.items.data.map((item: { price: { id: string } }) => ({
        price: item.price.id,
        quantity: 1,
      }));

      let schedule: StripeSdk.SubscriptionSchedule;
      if (data.providerSubscriptionScheduleId) {
        schedule = await client.subscriptionSchedules.retrieve(data.providerSubscriptionScheduleId);
      } else {
        // Check if the subscription already has a schedule attached (e.g. from a prior failed attempt).
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

      // The current phase was created by Stripe when we did `from_subscription`.
      // We must preserve its original start_date (Stripe forbids modifying it).
      const currentPhase = schedule.phases[0];
      const currentPhaseStart = currentPhase?.start_date ?? Math.floor(Date.now() / 1000);

      // Two-phase schedule: current plan until period end, then new plan.
      await client.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          {
            items: currentItems,
            start_date: currentPhaseStart,
            end_date: periodEndSeconds,
          },
          {
            items: [{ price: data.providerPriceId, quantity: 1 }],
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

      // Release any attached schedule before modifying the subscription directly.
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
      // Release any attached schedule (from a prior downgrade/schedule_change).
      // Check both our stored ID and Stripe's subscription directly.
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

    async syncProduct(data) {
      let providerProductId = data.existingProviderProductId;
      if (!providerProductId) {
        const stripeProduct = await client.products.create({
          metadata: { paykit_product_id: data.id },
          name: data.name,
        });
        providerProductId = stripeProduct.id;
      } else {
        await client.products.update(providerProductId, { name: data.name });
      }

      if (data.existingProviderPriceId) {
        return { providerPriceId: data.existingProviderPriceId, providerProductId };
      }

      const priceParams: StripeSdk.PriceCreateParams = {
        currency,
        product: providerProductId,
        unit_amount: data.priceAmount,
      };
      if (data.priceInterval) {
        const recurring = getStripeRecurringInterval(data.priceInterval as PlanInterval);
        priceParams.recurring = {
          interval: recurring.interval,
          interval_count: recurring.count,
        };
      }
      const stripePrice = await client.prices.create(priceParams);

      return { providerPriceId: stripePrice.id, providerProductId };
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
      const signature = data.headers["stripe-signature"];
      if (!signature) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING);
      }

      const event = client.webhooks.constructEvent(data.body, signature, options.webhookSecret);
      return [
        ...(await createCheckoutCompletedEvents(client, event)),
        ...(await createSubscriptionEvents(event)),
        ...createInvoiceEvents(event),
        ...createDetachedPaymentMethodEvents(event),
      ];
    },

    async createPortalSession(data) {
      const session = await client.billingPortal.sessions.create({
        customer: data.providerCustomerId,
        return_url: data.returnUrl,
      });
      return { url: session.url };
    },
  };
}

export function createStripeRuntime(options: StripeProviderConfig): StripeRuntime {
  return createStripeProvider(new StripeSdk(options.secretKey), options);
}
