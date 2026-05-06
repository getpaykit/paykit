import { Polar } from "@polar-sh/sdk";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { PayKitError, PAYKIT_ERROR_CODES } from "paykitjs";
import type { NormalizedWebhookEvent, PayKitProviderConfig, PaymentProvider } from "paykitjs";

export interface PolarOptions {
  accessToken: string;
  webhookSecret: string;
  server?: "production" | "sandbox";
}

export type PolarProviderConfig = PayKitProviderConfig & {
  capabilities: { testClocks: false };
};

type PolarWebhookEvent = ReturnType<typeof validateEvent>;
type PolarSubscriptionEvent = Extract<PolarWebhookEvent, { type?: `subscription.${string}` }>;
type PolarCheckoutEvent = Extract<PolarWebhookEvent, { type?: `checkout.${string}` }>;
type PolarCustomer = Awaited<ReturnType<Polar["customers"]["list"]>>["result"]["items"][number];
type PolarProduct = Awaited<ReturnType<Polar["products"]["list"]>>["result"]["items"][number];
type PolarSubscription = Awaited<ReturnType<Polar["subscriptions"]["get"]>>;
type PolarSubscriptionLike = Pick<
  PolarSubscription,
  | "cancelAtPeriodEnd"
  | "canceledAt"
  | "currentPeriodEnd"
  | "currentPeriodStart"
  | "endedAt"
  | "id"
  | "productId"
  | "status"
>;

const PAYKIT_CUSTOMER_METADATA_KEY = "paykitCustomerId";
const PAYKIT_PRODUCT_METADATA_KEY = "paykitProductId";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function normalizePolarSubscription(sub: PolarSubscriptionLike) {
  return {
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: toDate(sub.canceledAt),
    currentPeriodEndAt: toDate(sub.currentPeriodEnd),
    currentPeriodStartAt: toDate(sub.currentPeriodStart),
    endedAt: toDate(sub.endedAt),
    providerProduct: { productId: sub.productId },
    providerSubscriptionId: sub.id,
    providerSubscriptionScheduleId: null,
    status: sub.status,
  };
}

async function findExistingCustomer(
  client: Polar,
  data: { email: string; id: string },
): Promise<PolarCustomer | null> {
  const byEmail = await client.customers.list({ email: data.email, limit: 1 });
  const emailMatch = byEmail.result.items.find((customer) => customer.email === data.email);
  if (emailMatch) return emailMatch;

  const byExternalId = await client.customers.list({ query: data.id, limit: 100 });
  return byExternalId.result.items.find((customer) => customer.externalId === data.id) ?? null;
}

function isPotentialDuplicateCustomerError(error: unknown): error is HTTPValidationError {
  return error instanceof HTTPValidationError && error.statusCode === 422;
}

function normalizeMetadata(
  metadata: Record<string, string> | undefined,
  paykitCustomerId: string,
): Record<string, string> {
  return {
    ...metadata,
    [PAYKIT_CUSTOMER_METADATA_KEY]: paykitCustomerId,
  };
}

function createSubscriptionEvents(
  event: { type?: string; data: PolarSubscriptionEvent["data"] },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const sub = event.data;

  // `subscription.revoked` = immediately terminated (like Stripe delete)
  // `subscription.canceled` = will cancel at period end (like Stripe cancel_at_period_end)
  if (event.type === "subscription.revoked") {
    return [
      {
        actions: [
          {
            data: {
              providerCustomerId: sub.customerId,
              providerSubscriptionId: sub.id,
            },
            type: "subscription.delete",
          },
        ],
        name: "subscription.deleted",
        payload: {
          providerCustomerId: sub.customerId,
          providerEventId: webhookId,
          providerSubscriptionId: sub.id,
        },
      },
    ];
  }

  const normalized = normalizePolarSubscription(sub);
  return [
    {
      actions: [
        {
          data: {
            providerCustomerId: sub.customerId,
            subscription: normalized,
          },
          type: "subscription.upsert",
        },
      ],
      name: "subscription.updated",
      payload: {
        providerCustomerId: sub.customerId,
        providerEventId: webhookId,
        subscription: normalized,
      },
    },
  ];
}

async function createCheckoutEvents(
  client: Polar,
  event: { type?: string; data: PolarCheckoutEvent["data"] },
  webhookId: string,
): Promise<NormalizedWebhookEvent[]> {
  const checkout = event.data;
  if (checkout.status !== "succeeded") return [];

  const providerCustomerId = checkout.customerId;
  if (!providerCustomerId) return [];

  const subscription = checkout.subscriptionId
    ? normalizePolarSubscription(await client.subscriptions.get({ id: checkout.subscriptionId }))
    : undefined;

  return [
    {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: checkout.id,
        mode: "subscription",
        paymentStatus: "paid",
        providerCustomerId,
        providerEventId: webhookId,
        providerSubscriptionId: checkout.subscriptionId ?? undefined,
        status: checkout.status,
        subscription,
        metadata: checkout.metadata
          ? Object.fromEntries(Object.entries(checkout.metadata).map(([k, v]) => [k, String(v)]))
          : undefined,
      },
    },
  ];
}

function notSupported(method: string): never {
  throw PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
    `${method} is not supported by the Polar provider`,
  );
}

async function listActiveProducts(client: Polar): Promise<PolarProduct[]> {
  const products: PolarProduct[] = [];
  const firstPage = await client.products.list({ isArchived: false, limit: 100 });

  for await (const page of firstPage) {
    products.push(...(page.result.items ?? []));
  }

  return products;
}

function isPayKitManagedProduct(product: PolarProduct): boolean {
  return typeof product.metadata[PAYKIT_PRODUCT_METADATA_KEY] === "string";
}

function productMetadata(productId: string): Record<string, string> {
  return { [PAYKIT_PRODUCT_METADATA_KEY]: productId };
}

export function createPolarProvider(client: Polar, options: PolarOptions): PaymentProvider {
  return {
    id: "polar",
    name: "Polar",
    capabilities: { testClocks: false },

    async createCustomer(data) {
      if (!data.email) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Polar requires a non-empty email to create a customer",
        );
      }

      const customerMetadata = normalizeMetadata(data.metadata, data.id);

      try {
        const customer = await client.customers.create({
          email: data.email,
          externalId: data.id,
          name: data.name,
          metadata: customerMetadata,
        });

        return {
          providerCustomer: { id: customer.id },
        };
      } catch (error) {
        if (!isPotentialDuplicateCustomerError(error)) throw error;

        const existing = await findExistingCustomer(client, { email: data.email, id: data.id });

        if (!existing) {
          throw error;
        }

        await client.customers.update({
          id: existing.id,
          customerUpdate: {
            name: data.name,
            metadata: {
              ...existing.metadata,
              ...customerMetadata,
            },
          },
        });

        return {
          providerCustomer: { id: existing.id },
        };
      }
    },

    async updateCustomer(data) {
      const existing = await client.customers.get({ id: data.providerCustomerId });

      await client.customers.update({
        id: data.providerCustomerId,
        customerUpdate: {
          email: data.email,
          name: data.name,
          metadata: {
            ...existing.metadata,
            ...data.metadata,
          },
        },
      });
    },

    async deleteCustomer(data) {
      await client.customers.delete({ id: data.providerCustomerId });
    },

    getTestClock() {
      return notSupported("getTestClock");
    },

    advanceTestClock() {
      return notSupported("advanceTestClock");
    },

    attachPaymentMethod() {
      return notSupported("attachPaymentMethod");
    },

    async createSubscriptionCheckout(data) {
      const checkout = await client.checkouts.create({
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

    createSubscription() {
      return notSupported("createSubscription (use checkout instead)");
    },

    async updateSubscription(data) {
      const sub = await client.subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          productId: data.providerProduct.productId!,
          prorationBehavior: "invoice",
        },
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEndAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
          currentPeriodStartAt: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    createInvoice() {
      return notSupported("createInvoice");
    },

    async scheduleSubscriptionChange(data) {
      const current = await client.subscriptions.get({ id: data.providerSubscriptionId });
      const wasCanceled = current.cancelAtPeriodEnd;

      // Un-cancel to allow product update (Polar rejects updates on canceled subs)
      if (wasCanceled) {
        await client.subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: false },
        });
      }

      await client.subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          productId: data.providerProduct!.productId!,
          prorationBehavior: "next_period",
        },
      });

      // Re-cancel if it was previously canceled (preserve cancel-at-period-end intent)
      if (wasCanceled) {
        await client.subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: true },
        });
      }

      const sub = await client.subscriptions.get({ id: data.providerSubscriptionId });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEndAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
          currentPeriodStartAt: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    async cancelSubscription(data) {
      const sub = await client.subscriptions.update({
        id: data.providerSubscriptionId,
        subscriptionUpdate: {
          cancelAtPeriodEnd: true,
        },
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEndAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
          currentPeriodStartAt: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    async listActiveSubscriptions(data) {
      const result = await client.subscriptions.list({
        customerId: data.providerCustomerId,
      });

      return (result.result.items ?? [])
        .filter((sub) => sub.status === "active" || sub.status === "trialing")
        .map((sub) => ({ providerSubscriptionId: sub.id }));
    },

    async resumeSubscription(data) {
      const current = await client.subscriptions.get({ id: data.providerSubscriptionId });

      // Un-cancel first if pending cancellation
      if (current.cancelAtPeriodEnd) {
        await client.subscriptions.update({
          id: data.providerSubscriptionId,
          subscriptionUpdate: { cancelAtPeriodEnd: false },
        });
      }

      // Clear pending product change if any
      const sub = current.pendingUpdate
        ? await client.subscriptions.update({
            id: data.providerSubscriptionId,
            subscriptionUpdate: { productId: current.productId },
          })
        : await client.subscriptions.get({ id: data.providerSubscriptionId });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEndAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
          currentPeriodStartAt: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    detachPaymentMethod() {
      return notSupported("detachPaymentMethod");
    },

    async syncProducts(data) {
      const [allPolarProducts, orgs] = await Promise.all([
        listActiveProducts(client),
        client.organizations.list({ limit: 1 }),
      ]);

      const org = orgs.result.items?.[0];
      const polarProductMap = new Map(allPolarProducts.map((p) => [p.id, p]));

      const activeProductIds = new Set<string>();

      const results = await Promise.all(
        data.products.map(async (product) => {
          const existingProductId = product.existingProviderProduct?.productId ?? null;
          const existingPolarProduct = existingProductId
            ? polarProductMap.get(existingProductId)
            : null;

          if (existingPolarProduct) {
            const intervalMatches =
              existingPolarProduct.recurringInterval === (product.priceInterval ?? null);

            if (intervalMatches) {
              const updated = await client.products.update({
                id: existingPolarProduct.id,
                productUpdate: {
                  name: product.name,
                  metadata: productMetadata(product.id),
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
              activeProductIds.add(updated.id);
              return { id: product.id, providerProduct: { productId: updated.id } };
            }

            // Interval changed — archive old, create new
            await client.products.update({
              id: existingPolarProduct.id,
              productUpdate: { isArchived: true },
            });
          }

          const created = await client.products.create({
            name: product.name,
            metadata: productMetadata(product.id),
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
          activeProductIds.add(created.id);
          return { id: product.id, providerProduct: { productId: created.id } };
        }),
      );

      // Archive orphans + configure org settings in parallel
      const cleanup: Promise<unknown>[] = [];

      for (const [polarId, polarProduct] of polarProductMap) {
        if (isPayKitManagedProduct(polarProduct) && !activeProductIds.has(polarId)) {
          cleanup.push(
            client.products.update({
              id: polarId,
              productUpdate: { isArchived: true },
            }),
          );
        }
      }

      if (org) {
        cleanup.push(
          client.organizations.update({
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

      return { results };
    },

    async handleWebhook(data): Promise<NormalizedWebhookEvent[]> {
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
        // Unknown event types (e.g. member.created) — ignore silently
        if (error instanceof SDKValidationError) {
          return [];
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
        case "subscription.revoked":
          return createSubscriptionEvents(event, webhookId);
        case "checkout.created":
        case "checkout.updated":
          return createCheckoutEvents(client, event, webhookId);
        default:
          return [];
      }
    },

    async createPortalSession(data) {
      const session = await client.customerSessions.create({
        customerId: data.providerCustomerId,
      });

      return {
        url: session.customerPortalUrl,
      };
    },

    async check() {
      try {
        await client.products.list({ limit: 1 });

        const customers = await client.customers.list({
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
          webhookEndpoints: [],
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

export function polar(polarOptions: PolarOptions): PolarProviderConfig {
  return {
    id: "polar",
    name: "Polar",
    capabilities: { testClocks: false },
    createAdapter(): PaymentProvider {
      const client = new Polar({
        accessToken: polarOptions.accessToken,
        server: polarOptions.server ?? "production",
      });
      return createPolarProvider(client, polarOptions);
    },
  };
}
