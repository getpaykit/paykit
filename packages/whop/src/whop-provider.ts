import Whop from "@whop/sdk";
import type { UnwrapWebhookEvent, WebhookEvent } from "@whop/sdk/resources/webhooks";
import { PayKitError, PAYKIT_ERROR_CODES } from "paykitjs";
import type { NormalizedWebhookEvent, PayKitProviderConfig, PaymentProvider } from "paykitjs";

export interface WhopOptions {
  apiKey: string;
  companyId: string;
}

export type WhopProviderConfig = PayKitProviderConfig & {
  capabilities: { testClocks: false };
};

type WhopSubscriptionEvent = Extract<UnwrapWebhookEvent, { type: `membership.${string}` }>;
type WhopCheckoutEvent = Extract<UnwrapWebhookEvent, { type: `payment.${string}` }>;

function notSupported(method: string): never {
  throw PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
    `${method} is not supported by the Whop provider`,
  );
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function normalizeWhopSubscription(sub: WhopSubscriptionEvent["data"]) {
  return {
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
    currentPeriodEndAt: toDate(sub.renewal_period_end),
    currentPeriodStartAt: toDate(sub.renewal_period_start),
    endedAt: null,
    providerProduct: { productId: sub.product.id },
    providerSubscriptionId: sub.id,
    providerSubscriptionScheduleId: null,
    status: sub.status,
  };
}

function createSubscriptionEvents(
  event: { type?: string; data: WhopSubscriptionEvent["data"] },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const sub = event.data;

  const providerCustomerId = sub.user?.id;
  if (!providerCustomerId) return [];

  if (event.type === "membership.deactivated") {
    return [
      {
        actions: [
          {
            data: {
              providerCustomerId,
              providerSubscriptionId: sub.id,
            },
            type: "subscription.delete",
          },
        ],
        name: "subscription.deleted",
        payload: {
          providerCustomerId,
          providerEventId: webhookId,
          providerSubscriptionId: sub.id,
        },
      },
    ];
  }

  const normalized = normalizeWhopSubscription(sub);

  return [
    {
      actions: [
        {
          data: {
            providerCustomerId,
            subscription: normalized,
          },
          type: "subscription.upsert",
        },
      ],
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
  event: { type?: string; data: WhopCheckoutEvent["data"] },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const checkout = event.data;
  if (checkout.status !== "paid") return [];

  const providerCustomerId = checkout.user?.id;
  if (!providerCustomerId) return [];

  return [
    {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: checkout.id,
        mode: "subscription",
        paymentStatus: "paid",
        providerCustomerId,
        providerEventId: webhookId,
        providerSubscriptionId: checkout.membership?.id || undefined,
        status: checkout.status,
        metadata: checkout.metadata
          ? Object.fromEntries(Object.entries(checkout.metadata).map(([k, v]) => [k, String(v)]))
          : undefined,
      },
    },
  ];
}

export function createWhopProvider(client: Whop, options: WhopOptions): PaymentProvider {
  return {
    id: "whop",
    name: "Whop",
    capabilities: { testClocks: false },

    createCustomer() {
      return notSupported("createCustomer");
    },

    updateCustomer() {
      return notSupported("updateCustomer");
    },

    deleteCustomer() {
      return notSupported("deleteCustomer");
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
      const checkout = await client.checkoutConfigurations.create({
        plan_id: data.providerProduct.productId!,
        metadata: data.metadata,
        redirect_url: data.successUrl,
      });

      if (!checkout.purchase_url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: checkout.purchase_url,
        providerCheckoutSessionId: checkout.id,
      };
    },

    createSubscription() {
      return notSupported("createSubscription (use checkout instead)");
    },

    updateSubscription() {
      return notSupported("updateSubscription");
    },

    createInvoice() {
      return notSupported("createInvoice"); // we dont have enough data from paykit
    },

    scheduleSubscriptionChange() {
      return notSupported("scheduleSubscriptionChange");
    },

    async cancelSubscription(data) {
      const sub = await client.memberships.cancel(data.providerSubscriptionId, {
        cancellation_mode: "at_period_end",
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEndAt: toDate(sub.renewal_period_end),
          currentPeriodStartAt: toDate(sub.renewal_period_start),
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    async listActiveSubscriptions(data) {
      const result = await client.memberships.list({
          statuses: ["active", "trialing"],
      });

        return result.data
            .filter((sub) => sub.user?.id === data.providerCustomerId)
            .map((sub) => ({ providerSubscriptionId: sub.id }));
    },

    async resumeSubscription(data) {
      const sub = await client.memberships.resume(data.providerSubscriptionId);

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEndAt: toDate(sub.renewal_period_end),
          currentPeriodStartAt: toDate(sub.renewal_period_start),
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    detachPaymentMethod() {
      return notSupported("detachPaymentMethod");
    },

    // need testing
    async syncProducts(data) {
      const results = data.products.map((product) => {
        const productId = product.existingProviderProduct?.productId ?? null;
        if (!productId) {
          throw PayKitError.from(
            "BAD_REQUEST",
            PAYKIT_ERROR_CODES.PLAN_NOT_SYNCED,
            `Missing Whop plan_id for product ${product.id}. Set providerProduct.productId to the Whop plan id.`,
          );
        }

        return { id: product.id, providerProduct: { productId } };
      });

      return { results };
    },

    async handleWebhook(data): Promise<NormalizedWebhookEvent[]> {
      const webhookIdKey = Object.keys(data.headers).find(
        (k) => k.toLocaleLowerCase() === "webhook-id",
      );
      const webhookId = webhookIdKey ? data.headers[webhookIdKey]! : "";

      let event: UnwrapWebhookEvent;
      try {
        event = client.webhooks.unwrap(data.body, { headers: data.headers });
      } catch {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING,
          "Invalid Whop webhook signature",
        );
      }

      switch (event.type) {
        case "membership.activated":
        case "membership.deactivated":
        case "membership.cancel_at_period_end_changed":
          return createSubscriptionEvents(event, webhookId);
        case "payment.created":
          return createCheckoutEvents(event, webhookId);
        default:
          return [];
      }
    },

    createPortalSession() {
      return notSupported("createPortalSession");
    },

    async check() {
      try {
        await client.payments.list({ first: 1 });

        const customers = await client.members.list({
          first: 5,
        });
        const customerSample = (customers.data ?? []).map((c) => ({
          providerEmail: c.user?.email ?? "",
          paykitCustomerId: (c.user?.id as string) ?? null,
        }));

        return {
          ok: true,
          displayName: "Whop",
          mode: options.companyId.startsWith("biz") ? "production" : "sandbox",
          webhookEndpoints: [],
          customerSample,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          mode: options.companyId.startsWith("biz") ? "production" : "sandbox",
          displayName: "Whop",
          error: message,
        };
      }
    },
  };
}

export function whop(whopOptions: WhopOptions): WhopProviderConfig {
  return {
    id: "whop",
    name: "Whop",
    capabilities: { testClocks: false },
    createAdapter(): PaymentProvider {
      const client = new Whop({
        apiKey: whopOptions.apiKey,
      });
      return createWhopProvider(client, whopOptions);
    },
  };
}
