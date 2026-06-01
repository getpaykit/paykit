import { Polar } from "@polar-sh/sdk";
import { WebhookEventType } from "@polar-sh/sdk/models/components/webhookeventtype";
import { WebhookFormat } from "@polar-sh/sdk/models/components/webhookformat";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { PayKitError, PAYKIT_ERROR_CODES } from "paykitjs";
import type { NormalizedWebhookEvent, PayKitProvider } from "paykitjs";

export interface PolarOptions {
  accessToken: string;
  webhookSecret: string;
  server?: "production" | "sandbox";
}

type PolarWebhookEvent = ReturnType<typeof validateEvent>;
type PolarSubscriptionEvent = Extract<PolarWebhookEvent, { type?: `subscription.${string}` }>;
type PolarCheckoutEvent = Extract<PolarWebhookEvent, { type?: `checkout.${string}` }>;
type PolarWebhookData = Record<string, unknown>;
type PolarClient = InstanceType<typeof Polar>;

const polarCapabilities = {
  subscriptionProducts: true,
  subscriptionCheckout: true,
  customerPortal: true,
  createInvoices: false,
  detachPaymentMethods: false,
  setupPaymentMethods: false,
  cancelSubscriptionsAtPeriodEnd: true,
  createSubscriptions: false,
  changeSubscriptionProducts: true,
  listActiveSubscriptions: true,
  pendingSubscriptionProductChanges: true,
  resumeSubscriptionsAtPeriodEnd: true,
  subscriptionSchedules: false,
  testClocks: false,
  manageWebhookEndpoints: true,
} as const satisfies PayKitProvider["capabilities"];

export type PolarProvider = PayKitProvider<typeof polarCapabilities>;

const POLAR_WEBHOOK_EVENTS = [
  WebhookEventType.CheckoutCreated,
  WebhookEventType.CheckoutUpdated,
  WebhookEventType.SubscriptionCreated,
  WebhookEventType.SubscriptionUpdated,
  WebhookEventType.SubscriptionActive,
  WebhookEventType.SubscriptionUncanceled,
  WebhookEventType.SubscriptionCanceled,
  WebhookEventType.SubscriptionPastDue,
  WebhookEventType.SubscriptionRevoked,
];

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function getString(data: PolarWebhookData, camelKey: string, snakeKey: string): string | null {
  const value = data[camelKey] ?? data[snakeKey];
  return typeof value === "string" ? value : null;
}

function getEntityId(data: PolarWebhookData, key: string): string | null {
  const value = data[key];
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function getBoolean(data: PolarWebhookData, camelKey: string, snakeKey: string): boolean {
  return data[camelKey] === true || data[snakeKey] === true;
}

function getDateValue(data: PolarWebhookData, camelKey: string, snakeKey: string) {
  const value = data[camelKey] ?? data[snakeKey];
  return value instanceof Date || typeof value === "string" ? value : null;
}

function getMetadata(data: PolarWebhookData): Record<string, string> | undefined {
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]));
}

function normalizePolarSubscription(sub: PolarWebhookData) {
  const data = sub as PolarWebhookData;

  return {
    cancelAtPeriodEnd: getBoolean(data, "cancelAtPeriodEnd", "cancel_at_period_end"),
    canceledAt: toDate(getDateValue(data, "canceledAt", "canceled_at")),
    currentPeriodEndAt: toDate(getDateValue(data, "currentPeriodEnd", "current_period_end")),
    currentPeriodStartAt: toDate(getDateValue(data, "currentPeriodStart", "current_period_start")),
    endedAt: toDate(getDateValue(data, "endedAt", "ended_at")),
    providerProduct: {
      productId: getString(data, "productId", "product_id") ?? getEntityId(data, "product") ?? "",
    },
    providerSubscriptionId: getString(data, "id", "id") ?? "",
    providerSubscriptionScheduleId: null,
    status: getString(data, "status", "status") ?? "unknown",
  };
}

function createSubscriptionEvents(
  event: { type?: string; data: PolarSubscriptionEvent["data"] },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const sub = event.data;
  const data = sub as PolarWebhookData;
  const providerCustomerId =
    getString(data, "customerId", "customer_id") ?? getEntityId(data, "customer");
  const providerSubscriptionId = getString(data, "id", "id");

  if (!providerCustomerId || !providerSubscriptionId) return [];

  // `subscription.revoked` = immediately terminated (like Stripe delete)
  // `subscription.canceled` = will cancel at period end (like Stripe cancel_at_period_end)
  if (event.type === "subscription.revoked") {
    return [
      {
        name: "subscription.deleted",
        payload: {
          providerCustomerId,
          providerEventId: webhookId,
          providerSubscriptionId,
        },
      },
    ];
  }

  const normalized = normalizePolarSubscription(sub);
  return [
    {
      name: "subscription.updated",
      payload: {
        providerCustomerId,
        providerEventId: webhookId,
        subscription: normalized,
      },
    },
  ];
}

function createCheckoutEvents(
  event: { type?: string; data: PolarCheckoutEvent["data"] },
  webhookId: string,
  subscriptionData?: PolarSubscriptionEvent["data"],
): NormalizedWebhookEvent[] {
  const checkout = event.data;
  const data = checkout as PolarWebhookData;

  const providerCustomerId =
    getString(data, "customerId", "customer_id") ?? getEntityId(data, "customer");
  const providerSubscriptionId =
    getString(data, "subscriptionId", "subscription_id") ?? getEntityId(data, "subscription");
  const status = getString(data, "status", "status") ?? "unknown";
  if (!providerCustomerId) return [];
  if (!providerSubscriptionId) return [];

  const subscription = subscriptionData
    ? normalizePolarSubscription(subscriptionData)
    : normalizePolarSubscription({
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        currentPeriodStart: null,
        id: providerSubscriptionId,
        productId: getString(data, "productId", "product_id") ?? getEntityId(data, "product"),
        status: "active",
      });

  return [
    {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: getString(data, "id", "id") ?? "",
        mode: "subscription",
        paymentStatus: "paid",
        providerCustomerId,
        providerEventId: webhookId,
        providerSubscriptionId: providerSubscriptionId ?? undefined,
        status,
        subscription,
        metadata: getMetadata(data),
      },
    },
  ];
}

async function createCheckoutEventsFromSdk(
  client: PolarClient,
  event: { type?: string; data: PolarCheckoutEvent["data"] },
  webhookId: string,
): Promise<NormalizedWebhookEvent[]> {
  const events = createCheckoutEvents(event, webhookId);
  if (events.length > 0) return events;

  const data = event.data as PolarWebhookData;
  const status = getString(data, "status", "status") ?? "unknown";
  if (status !== "confirmed" && status !== "succeeded") return [];

  const checkoutId = getString(data, "id", "id");
  if (!checkoutId) return [];

  const checkout = await client.checkouts.get({ id: checkoutId });
  const checkoutData = checkout as PolarCheckoutEvent["data"];
  const subscriptionId = getString(
    checkout as PolarWebhookData,
    "subscriptionId",
    "subscription_id",
  );
  if (subscriptionId) {
    const subscription = await client.subscriptions.get({ id: subscriptionId });
    return createCheckoutEvents({ type: event.type, data: checkoutData }, webhookId, subscription);
  }

  return [];
}

function createRawWebhookEvents(body: string, webhookId: string): NormalizedWebhookEvent[] {
  const event = JSON.parse(body) as { type?: string; data?: unknown };
  if (!event.data || typeof event.data !== "object") return [];

  switch (event.type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.active":
    case "subscription.uncanceled":
    case "subscription.canceled":
    case "subscription.past_due":
    case "subscription.revoked":
      return createSubscriptionEvents(
        { type: event.type, data: event.data as PolarSubscriptionEvent["data"] },
        webhookId,
      );
    case "checkout.created":
    case "checkout.updated":
      return createCheckoutEvents(
        { type: event.type, data: event.data as PolarCheckoutEvent["data"] },
        webhookId,
      );
    default:
      return [];
  }
}

function normalizeProviderSubscription(sub: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: Date | string | null;
  currentPeriodStart?: Date | string | null;
  id: string;
  productId?: string | null;
  status: string;
}) {
  return {
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEndAt: toDate(sub.currentPeriodEnd),
    currentPeriodStartAt: toDate(sub.currentPeriodStart),
    providerProduct: sub.productId ? { productId: sub.productId } : null,
    providerSubscriptionId: sub.id,
    status: sub.status,
  };
}

export function polar(options: PolarOptions): PolarProvider {
  let client: Polar | null = null;
  const getPolar = () => {
    client ??= new Polar({
      accessToken: options.accessToken,
      server: options.server ?? "production",
    });
    return client;
  };

  let polarProductMapPromise: Promise<
    Map<string, { id: string; recurringInterval?: string | null }>
  > | null = null;

  const getPolarProductMap = async () => {
    polarProductMapPromise ??= getPolar()
      .products.list({ isArchived: false, limit: 100 })
      .then((result) => new Map((result.result.items ?? []).map((p) => [p.id, p])));
    return polarProductMapPromise;
  };
  const getWebhookEndpointAccount = async () => {
    const orgs = await getPolar().organizations.list({ limit: 1 });
    const org = orgs.result.items?.[0];

    if (!org) {
      throw PayKitError.from(
        "INTERNAL_SERVER_ERROR",
        PAYKIT_ERROR_CODES.PROVIDER_INVALID_CONFIG,
        "No Polar organization found for the configured access token",
      );
    }

    return {
      displayName: org.name,
      environment: options.server === "sandbox" ? "sandbox" : "production",
      providerAccountId: org.id,
      providerId: "polar",
    };
  };

  return {
    id: "polar",
    name: "Polar",
    capabilities: polarCapabilities,

    async upsertSubscriptionProduct(product) {
      const polarProductMap = await getPolarProductMap();
      const existingProductId = product.existingProviderProduct?.productId ?? null;
      const existingPolarProduct = existingProductId
        ? polarProductMap.get(existingProductId)
        : null;

      if (existingPolarProduct) {
        const intervalMatches =
          existingPolarProduct.recurringInterval === (product.priceInterval ?? null);

        if (intervalMatches) {
          const updated = await getPolar().products.update({
            id: existingPolarProduct.id,
            productUpdate: {
              name: product.name,
              visibility: "private",
              prices: [
                {
                  amountType: "fixed" as const,
                  priceAmount: product.priceAmount,
                  priceCurrency: "usd",
                },
              ],
            },
          });
          return { providerProduct: { productId: updated.id } };
        }

        await getPolar().products.update({
          id: existingPolarProduct.id,
          productUpdate: { isArchived: true },
        });
      }

      const created = await getPolar().products.create({
        name: product.name,
        visibility: "private",
        recurringInterval: (product.priceInterval as "month" | "year") ?? null,
        prices: [
          {
            amountType: "fixed" as const,
            priceAmount: product.priceAmount,
            priceCurrency: "usd",
          },
        ],
      });
      return { providerProduct: { productId: created.id } };
    },

    async cleanupSubscriptionProducts(data) {
      const [polarProductMap, orgs] = await Promise.all([
        getPolarProductMap(),
        getPolar().organizations.list({ limit: 1 }),
      ]);
      const activeProductIds = new Set(data.activeProviderProductIds);
      const cleanup: Promise<unknown>[] = [];

      for (const [polarId] of polarProductMap) {
        if (!activeProductIds.has(polarId)) {
          cleanup.push(
            getPolar().products.update({
              id: polarId,
              productUpdate: { isArchived: true },
            }),
          );
        }
      }

      const org = orgs.result.items?.[0];
      if (org) {
        cleanup.push(
          getPolar().organizations.update({
            id: org.id,
            organizationUpdate: {
              subscriptionSettings: {
                allowMultipleSubscriptions: true,
                allowCustomerUpdates: false,
                prorationBehavior: "invoice",
                benefitRevocationGracePeriod: org.subscriptionSettings.benefitRevocationGracePeriod,
                preventTrialAbuse: org.subscriptionSettings.preventTrialAbuse,
              },
              customerPortalSettings: {
                subscription: { updateSeats: false, updatePlan: false },
                usage: org.customerPortalSettings.usage,
              },
            },
          }),
        );
      }

      await Promise.all(cleanup);
    },

    async createCustomer(data) {
      if (!data.email) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Polar requires a non-empty email to create a customer",
        );
      }

      const customerMetadata = {
        ...data.metadata,
        paykitCustomerId: data.id,
      };

      try {
        const customer = await getPolar().customers.create({
          email: data.email,
          name: data.name,
          metadata: customerMetadata,
        });

        return {
          providerCustomer: { id: customer.id },
        };
      } catch (error) {
        if (!(error instanceof SDKValidationError)) throw error;

        // Duplicate email — find and re-link the existing customer.
        const list = await getPolar().customers.list({ query: data.email, limit: 1 });
        const existing = list.result.items[0];

        if (!existing) {
          throw PayKitError.from(
            "INTERNAL_SERVER_ERROR",
            PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND,
            "Failed to create or find customer on Polar",
          );
        }

        await getPolar().customers.update({
          id: existing.id,
          customerUpdate: {
            name: data.name,
            metadata: customerMetadata,
          },
        });

        return {
          providerCustomer: { id: existing.id },
        };
      }
    },

    async deleteCustomer(data) {
      await getPolar().customers.delete({ id: data.providerCustomerId });
    },

    async updateCustomer(data) {
      await getPolar().customers.update({
        id: data.providerCustomerId,
        customerUpdate: {
          email: data.email,
          name: data.name,
          metadata: data.metadata ?? {},
        },
      });
    },

    async createCustomerPortalSession(data) {
      const session = await getPolar().customerSessions.create({
        customerId: data.providerCustomerId,
      });

      return {
        url: session.customerPortalUrl,
      };
    },

    async createSubscriptionCheckout(data) {
      const checkout = await getPolar().checkouts.create({
        products: [data.providerProduct.productId!],
        customerId: data.providerCustomerId,
        metadata: data.metadata,
        successUrl: data.successUrl,
      });

      if (!checkout.url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: checkout.url,
        providerCheckoutSessionId: checkout.id,
      };
    },

    async changeSubscriptionProduct(data) {
      const sub = await getPolar().subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          productId: data.providerProduct.productId!,
          prorationBehavior: "invoice",
        },
      });

      return {
        paymentUrl: null,
        subscription: normalizeProviderSubscription(sub),
      };
    },

    async changeSubscriptionProductAtPeriodEnd(data) {
      const current = await getPolar().subscriptions.get({ id: data.providerSubscriptionId });
      const wasCanceled = current.cancelAtPeriodEnd;

      // Un-cancel to allow product update (Polar rejects updates on canceled subs)
      if (wasCanceled) {
        await getPolar().subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: false },
        });
      }

      await getPolar().subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          productId: data.providerProduct!.productId!,
          prorationBehavior: "next_period",
        },
      });

      // Re-cancel if it was previously canceled (preserve cancel-at-period-end intent)
      if (wasCanceled) {
        await getPolar().subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: true },
        });
      }

      const sub = await getPolar().subscriptions.get({ id: data.providerSubscriptionId });

      return {
        paymentUrl: null,
        subscription: normalizeProviderSubscription(sub),
      };
    },

    async cancelSubscriptionAtPeriodEnd(data) {
      const sub = await getPolar().subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          cancelAtPeriodEnd: true,
        },
      });

      return {
        paymentUrl: null,
        subscription: normalizeProviderSubscription(sub),
      };
    },

    async getSubscription(data) {
      return normalizeProviderSubscription(
        await getPolar().subscriptions.get({ id: data.providerSubscriptionId }),
      );
    },

    async listActiveSubscriptions(data) {
      const result = await getPolar().subscriptions.list({
        customerId: data.providerCustomerId,
      });

      return (result.result.items ?? [])
        .filter((sub) => sub.status === "active" || sub.status === "trialing")
        .map((sub) => ({ providerSubscriptionId: sub.id }));
    },

    async resumeSubscriptionAtPeriodEnd(data) {
      const current = await getPolar().subscriptions.get({ id: data.providerSubscriptionId });

      // Un-cancel first if pending cancellation
      if (current.cancelAtPeriodEnd) {
        await getPolar().subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: false },
        });
      }

      // Clear pending product change if any
      const sub = current.pendingUpdate
        ? await getPolar().subscriptions.update({
            id: data.providerSubscriptionId,
            subscriptionUpdate: { productId: current.productId },
          })
        : await getPolar().subscriptions.get({ id: data.providerSubscriptionId });

      return {
        paymentUrl: null,
        subscription: normalizeProviderSubscription(sub),
      };
    },

    async parseWebhook(data): Promise<NormalizedWebhookEvent[]> {
      const webhookIdKey = Object.keys(data.headers).find((k) => k.toLowerCase() === "webhook-id");
      const webhookId = webhookIdKey ? data.headers[webhookIdKey]! : "";

      let event: ReturnType<typeof validateEvent>;
      try {
        event = validateEvent(data.body, data.headers, options.webhookSecret);
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          throw PayKitError.from(
            "BAD_REQUEST",
            PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING,
            "Invalid Polar webhook signature",
          );
        }
        if (error instanceof SDKValidationError) {
          return createRawWebhookEvents(data.body, webhookId);
        }
        throw error;
      }

      switch (event.type) {
        case "subscription.created":
        case "subscription.updated":
        case "subscription.active":
        case "subscription.uncanceled":
        case "subscription.canceled":
        case "subscription.past_due":
        case "subscription.revoked": {
          const events = createSubscriptionEvents(event, webhookId);
          return events.length > 0 ? events : createRawWebhookEvents(data.body, webhookId);
        }
        case "checkout.created":
        case "checkout.updated": {
          const events = await createCheckoutEventsFromSdk(getPolar(), event, webhookId);
          return events.length > 0 ? events : createRawWebhookEvents(data.body, webhookId);
        }
        default:
          return [];
      }
    },

    async getWebhookEndpointAccount() {
      return getWebhookEndpointAccount();
    },

    async ensureWebhookEndpoint(data) {
      if (data.existingEndpointId) {
        try {
          const endpoint = await getPolar().webhooks.updateWebhookEndpoint({
            id: data.existingEndpointId,
            webhookEndpointUpdate: {
              enabled: true,
              events: POLAR_WEBHOOK_EVENTS,
              format: WebhookFormat.Raw,
              name: "PayKit",
              url: data.url,
            },
          });
          return {
            created: false,
            endpointId: endpoint.id,
            webhookSecret: options.webhookSecret,
          };
        } catch (error) {
          if (!(error instanceof Error) || !/not found|404/i.test(error.message)) {
            throw error;
          }
        }
      }

      const endpoint = await getPolar().webhooks.createWebhookEndpoint({
        events: POLAR_WEBHOOK_EVENTS,
        format: WebhookFormat.Raw,
        name: "PayKit",
        url: data.url,
      });

      return {
        created: true,
        endpointId: endpoint.id,
        webhookSecret: endpoint.secret,
      };
    },

    async deleteWebhookEndpoint(data) {
      await getPolar().webhooks.deleteWebhookEndpoint({ id: data.endpointId });
    },

    async check() {
      try {
        await getPolar().products.list({ limit: 1 });

        const endpoints = await getPolar().webhooks.listWebhookEndpoints({ limit: 100 });
        const webhookEndpoints = (endpoints.result.items ?? []).map((endpoint) => ({
          status: endpoint.enabled ? "enabled" : "disabled",
          url: endpoint.url,
        }));

        const customers = await getPolar().customers.list({
          limit: 5,
          sorting: ["created_at"],
        });
        const customerSample = (customers.result.items ?? []).map((c) => ({
          providerEmail: c.email ?? "",
          paykitCustomerId: (c.metadata?.paykitCustomerId as string) ?? null,
        }));

        return {
          ok: true,
          displayName: "Polar",
          mode: options.server === "sandbox" ? "sandbox" : "production",
          webhookEndpoints,
          customerSample,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          displayName: "Polar",
          mode: options.server === "sandbox" ? "sandbox" : "production",
          error: message,
        };
      }
    },
  };
}
