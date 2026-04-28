import DodoPayments, { ConflictError } from "dodopayments";
import type { WebhookEventType } from "dodopayments/resources/webhook-events.mjs";
import {
  PAYKIT_ERROR_CODES,
  PayKitError,
  type NormalizedWebhookEvent,
  type PayKitProviderConfig,
  type PaymentProvider,
} from "paykitjs";

export interface DodopaymentsOptions {
  bearerToken: string;
  webhookSecret: string;
  environment?: "live_mode" | "test_mode";
}

function notSupported(method: string): never {
  throw PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
    `${method} is not supported by the DodoPayments provider`,
  );
}

export function createDodopaymentsProvider(
  client: DodoPayments,
  options: DodopaymentsOptions,
): PaymentProvider {
  return {
    id: "dodopayments",
    name: "Dodopayments",
    async createCustomer(data) {
      if (!data.email) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Dodopayments requires a non-empty email to create a customer",
        );
      }
      if (!data.name) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Dodopayments requires a non-empty name to create a customer",
        );
      }

      const customerMetadata = {
        ...data.metadata,
        paykitCustomerId: data.id,
      };

      try {
        const customer = await client.customers.create({
          email: data.email,
          name: data.name,
          metadata: customerMetadata,
        });

        return {
          providerCustomer: { id: customer.customer_id },
        };
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;

        // Duplicate email — find and re-link the existing customer.
        const list = await client.customers.list({ email: data.email });
        const existing = list.items[0];

        if (!existing) {
          throw PayKitError.from(
            "INTERNAL_SERVER_ERROR",
            PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND,
            "Failed to create or find customer on Dodopayments",
          );
        }

        await client.customers.update(existing.customer_id, {
          name: data.name,
          metadata: customerMetadata,
        });

        return {
          providerCustomer: { id: existing.customer_id },
        };
      }
    },

    async updateCustomer(data) {
      await client.customers.update(data.providerCustomerId, {
        email: data.email,
        name: data.name,
        metadata: data.metadata ?? {},
      });
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
      const checkout = await client.checkoutSessions.create({
        // Our core type do not allow product quantity, but dodo requires it
        // Need to decide wether to change the core type or default product to 1
        product_cart: [{ product_id: data.providerProduct.productId!, quantity: 1 }],
        customer: {
          customer_id: data.providerCustomerId,
        },
        return_url: data.successUrl,
      });

      if (!checkout.checkout_url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: checkout.checkout_url,
        providerCheckoutSessionId: checkout.session_id,
      };
    },

    createSubscription() {
      return notSupported("createSubscription (use checkout instead)");
    },

    // NEED TO FIGURE THIS ONE OUT
    async updateSubscription(data) {
      await client.subscriptions.changePlan(data.providerSubscriptionId, {
        product_id: data.providerProduct.productId!,
        proration_billing_mode: "prorated_immediately",
        quantity: 1,
      });

      const sub = await client.subscriptions.retrieve(data.providerSubscriptionId);

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
          currentPeriodEndAt: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
          currentPeriodStartAt: sub.previous_billing_date
            ? new Date(sub.previous_billing_date)
            : null,
          providerSubscriptionId: sub.subscription_id,
          status: sub.status,
        },
      };
    },

    createInvoice() {
      return notSupported("createInvoice");
    },

    async scheduleSubscriptionChange(data) {
      const current = await client.subscriptions.retrieve(data.providerSubscriptionId);
      const wasCanceled = current.cancel_at_next_billing_date;

      if (wasCanceled) {
        await client.subscriptions.update(data.providerSubscriptionId, {
          cancel_at_next_billing_date: false,
        });
      }

      await client.subscriptions.changePlan(data.providerSubscriptionId, {
        product_id: data.providerProduct!.productId!,
        effective_at: "next_billing_date",
        quantity: 1,
        proration_billing_mode: "do_not_bill",
      });

      if (wasCanceled) {
        await client.subscriptions.update(data.providerSubscriptionId, {
          cancel_at_next_billing_date: true,
        });
      }

      const sub = await client.subscriptions.retrieve(data.providerSubscriptionId);

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
          currentPeriodEndAt: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
          currentPeriodStartAt: sub.previous_billing_date
            ? new Date(sub.previous_billing_date)
            : null,
          providerSubscriptionId: sub.subscription_id,
          status: sub.status,
        },
      };
    },

    async cancelSubscription(data) {
      const sub = await client.subscriptions.update(data.providerSubscriptionId, {
        cancel_at_next_billing_date: true,
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
          currentPeriodEndAt: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
          currentPeriodStartAt: sub.previous_billing_date
            ? new Date(sub.previous_billing_date)
            : null,
          providerSubscriptionId: sub.subscription_id,
          status: sub.status,
        },
      };
    },

    async listActiveSubscriptions(data) {
      const result = await client.subscriptions.list({
        customer_id: data.providerCustomerId,
      });

      return (result.items ?? [])
        .filter((sub) => sub.status === "active")
        .map((sub) => ({ providerSubscriptionId: sub.subscription_id }));
    },

    async resumeSubscription(data) {
      const current = await client.subscriptions.retrieve(data.providerSubscriptionId);

      // Un-cancel first if pending cancellation
      if (current.cancel_at_next_billing_date) {
        await client.subscriptions.update(data.providerSubscriptionId, {
          cancel_at_next_billing_date: false,
        });
      }

      let sub = current;

      // Clear scheduled plan change (if any)
      if (current.scheduled_change) {
        await client.subscriptions.changePlan(data.providerSubscriptionId, {
          product_id: current.product_id,
          effective_at: "immediately",
          proration_billing_mode: "do_not_bill",
          quantity: current.quantity ?? 1,
        });

        sub = await client.subscriptions.retrieve(data.providerSubscriptionId);
      }

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
          currentPeriodEndAt: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
          currentPeriodStartAt: sub.previous_billing_date
            ? new Date(sub.previous_billing_date)
            : null,
          providerSubscriptionId: sub.subscription_id,
          status: sub.status,
        },
      };
    },

    detachPaymentMethod() {
      return notSupported("detachPaymentMethod");
    },

    // TODO
    async syncProducts(data) {
      return { results: [] };
    },

    // TODO
    async handleWebhook(data): Promise<NormalizedWebhookEvent[]> {
      const headers = data.headers;

      const getHeader = (name: string) =>
        Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
          ? headers[Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())!]
          : undefined;

      const webhookId = getHeader("webhook-id") ?? "";
      const webhookSignature = getHeader("webhook-signature");
      const webhookTimestamp = getHeader("webhook-timestamp");

      let event: WebhookEventType;

      const webhookHeaders = {
        "webhook-id": webhookId as string,
        "webhook-signature": webhookSignature as string,
        "webhook-timestamp": webhookTimestamp as string,
      };

      try {
        const wh = client.webhooks.unwrap(data.body.toString(), { headers: webhookHeaders });
        event = wh.type;
      } catch (error) {
        // HANDLE OTHER ERRORS HERE
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING,
          "Invalid DodoPayments webhook signature",
        );
      }

      switch (event) {
        case "subscription.active":
        case "subscription.renewed":

        default:
          return [];
      }
    },

    async createPortalSession(data) {
      const session = await client.customers.customerPortal.create(data.providerCustomerId);
      return {
        url: session.link,
      };
    },

    async check() {
      try {
        await client.products.list({ page_size: 1 });

        const customers = await client.customers.list({ page_size: 5 });
        const customerSample = (customers.items ?? []).map((c) => ({
          providerEmail: c.email ?? "",
          paykitCustomerId: (c.metadata?.paykitCustomerId as string) ?? null,
        }));

        return {
          ok: true,
          displayName: "Dodopayments",
          mode: options.environment === "test_mode" ? "test_mode" : "live_mode",
          webhookEndpoints: [],
          customerSample,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          displayName: "Dodopayments",
          mode: options.environment === "test_mode" ? "test_mode" : "live_mode",
          error: message,
        };
      }
    },
  };
}

export function dodopayments(dodopaymentsOptions: DodopaymentsOptions): PayKitProviderConfig {
  return {
    id: "dodopayments",
    name: "Dodopayments",
    createAdapter(): PaymentProvider {
      const client = new DodoPayments({
        bearerToken: dodopaymentsOptions.bearerToken,
        environment: dodopaymentsOptions.environment ?? "live_mode",
      });

      return createDodopaymentsProvider(client, dodopaymentsOptions);
    },
  };
}
