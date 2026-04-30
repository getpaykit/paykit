import DodoPayments, { ConflictError } from "dodopayments";
import type { Payment as DodoPayment } from "dodopayments/resources/payments.mjs";
import type { Subscription as DodoSubscription } from "dodopayments/resources/subscriptions.mjs";
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
  taxCategory?: "digital_products" | "saas" | "e_book" | "edtech";
}

function notSupported(method: string): never {
  throw PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
    `${method} is not supported by the DodoPayments provider`,
  );
}

function normalizeDodoSubscription(sub: DodoSubscription) {
  return {
    cancelAtPeriodEnd: sub.cancel_at_next_billing_date,
    canceledAt: sub.cancelled_at ? new Date(sub.cancelled_at) : null,
    currentPeriodEndAt: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
    currentPeriodStartAt: sub.previous_billing_date ? new Date(sub.previous_billing_date) : null,
    endedAt: sub.status === "expired" || sub.status === "cancelled" ? new Date() : null,
    providerProduct: { productId: sub.product_id },
    providerSubscriptionId: sub.subscription_id,
    providerSubscriptionScheduleId: null,
    status: sub.status,
  };
}

// TESTING NEEDED HERE
function createSubscriptionEvents(
  event: { type?: string; data: DodoSubscription },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const sub = event.data;
  const normalized = normalizeDodoSubscription(sub);
  const customerId = sub.customer.customer_id;

  // Handle terminal states as delete
  if (event.type === "subscription.expired" || event.type === "subscription.cancelled") {
    return [
      {
        actions: [
          {
            data: {
              providerCustomerId: customerId,
              providerSubscriptionId: sub.subscription_id,
            },
            type: "subscription.delete",
          },
        ],
        name: "subscription.deleted",
        payload: {
          providerCustomerId: customerId,
          providerEventId: webhookId,
          providerSubscriptionId: sub.subscription_id,
        },
      },
    ];
  }

  // All other subscription events are upserts
  return [
    {
      actions: [
        {
          data: {
            providerCustomerId: customerId,
            subscription: normalized,
          },
          type: "subscription.upsert",
        },
      ],
      name: "subscription.updated",
      payload: {
        providerCustomerId: customerId,
        providerEventId: webhookId,
        subscription: normalized,
      },
    },
  ];
}

function createCheckoutEvents(
  event: { type?: string; data: DodoPayment },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const payment = event.data;
  if (payment.status !== "succeeded") return [];

  const providerCustomerId = payment.customer.customer_id;
  const subscriptionId = payment.subscription_id;

  return [
    {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: payment.payment_id,
        mode: subscriptionId ? "subscription" : "payment",
        paymentStatus: payment.status,
        providerCustomerId,
        providerEventId: webhookId,
        providerSubscriptionId: subscriptionId ?? undefined,
        status: payment.status,
      },
    },
  ];
}

function buildDodoPrice(
  priceAmount: number,
  priceInterval: string | null,
):
  | {
      currency: "USD";
      discount: number;
      price: number;
      purchasing_power_parity: false;
      type: "one_time_price";
    }
  | {
      currency: "USD";
      discount: number;
      payment_frequency_count: 1;
      payment_frequency_interval: "Month" | "Year";
      price: number;
      purchasing_power_parity: false;
      subscription_period_count: 1;
      subscription_period_interval: "Month" | "Year";
      type: "recurring_price";
    } {
  if (priceInterval) {
    const interval = priceInterval === "year" ? "Year" : "Month";
    return {
      type: "recurring_price",
      currency: "USD",
      price: priceAmount,
      discount: 0,
      purchasing_power_parity: false,
      payment_frequency_count: 1,
      payment_frequency_interval: interval,
      subscription_period_count: 1,
      subscription_period_interval: interval,
    };
  }
  return {
    type: "one_time_price",
    currency: "USD",
    price: priceAmount,
    discount: 0,
    purchasing_power_parity: false,
  };
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

    // NEEDS TESTING
    async updateSubscription(data) {
      const current = await client.subscriptions.retrieve(data.providerSubscriptionId);

      if (current.cancel_at_next_billing_date) {
        await client.subscriptions.update(data.providerSubscriptionId, {
          cancel_at_next_billing_date: false,
        });
      }

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

      if (current.scheduled_change) {
        await client.subscriptions.cancelChangePlan(data.providerSubscriptionId);
      }

      await client.subscriptions.changePlan(data.providerSubscriptionId, {
        product_id: data.providerProduct!.productId!,
        effective_at: "next_billing_date",
        quantity: 1,
        proration_billing_mode: "full_immediately",
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
        await client.subscriptions.cancelChangePlan(data.providerSubscriptionId);
        sub = await client.subscriptions.retrieve(data.providerSubscriptionId);
      }

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: false, // Force false, we just resumed subscription
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

    // NEEDS TESTING
    async syncProducts(data) {
      const allDodoProducts = await client.products.list({ archived: false });
      const dodoProductsMap = new Map((allDodoProducts.items ?? []).map((p) => [p.product_id, p]));

      const activeProductIds = new Set<string>();

      const results = await Promise.all(
        data.products.map(async (product) => {
          const existingProductId = product.existingProviderProduct?.productId ?? null;
          const existingDodoProduct = existingProductId
            ? dodoProductsMap.get(existingProductId)
            : null;

          const desiredInterval = product.priceInterval ?? null;
          const existingPrice = existingDodoProduct?.price_detail;

          const intervalMatches =
            (desiredInterval === null && existingPrice?.type === "one_time_price") ||
            (desiredInterval !== null &&
              existingPrice?.type === "recurring_price" &&
              existingPrice.payment_frequency_interval.toLowerCase() === desiredInterval);

          if (existingDodoProduct && intervalMatches) {
            await client.products.update(existingDodoProduct.product_id, {
              name: product.name,
              price: buildDodoPrice(product.priceAmount, desiredInterval),
            });
            activeProductIds.add(existingDodoProduct.product_id);
            return {
              id: product.id,
              providerProduct: { productId: existingDodoProduct.product_id },
            };
          }

          // Interval changed or no existing product — archive old, create new
          if (existingDodoProduct) {
            await client.products.archive(existingDodoProduct.product_id).catch(() => {});
            activeProductIds.delete(existingDodoProduct.product_id);
          }

          const created = await client.products.create({
            name: product.name,
            price: buildDodoPrice(product.priceAmount, desiredInterval),
            tax_category: options.taxCategory ?? "saas",
            metadata: { paykit_product_id: product.id },
          });

          activeProductIds.add(created.product_id);
          return { id: product.id, providerProduct: { productId: created.product_id } };
        }),
      );

      // Archive orphans (ignore errors for already-deleted products)
      const cleanup: Promise<unknown>[] = [];
      for (const [dodoId] of dodoProductsMap) {
        if (!activeProductIds.has(dodoId)) {
          cleanup.push(client.products.archive(dodoId).catch(() => {}));
        }
      }
      await Promise.all(cleanup);

      return { results };
    },

    // NEEDS TESTING
    async handleWebhook(data): Promise<NormalizedWebhookEvent[]> {
      const headers = data.headers;

      const getHeader = (name: string) =>
        Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
          ? headers[Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())!]
          : undefined;

      const webhookId = getHeader("webhook-id") ?? "";
      const webhookSignature = getHeader("webhook-signature");
      const webhookTimestamp = getHeader("webhook-timestamp");

      const webhookHeaders = {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature ?? "",
        "webhook-timestamp": webhookTimestamp ?? "",
      };

      let event: ReturnType<typeof client.webhooks.unwrap>;
      try {
        event = client.webhooks.unwrap(data.body, { headers: webhookHeaders });
      } catch {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING,
          "Invalid DodoPayments webhook signature",
        );
      }

      switch (event.type) {
        case "subscription.active":
        case "subscription.renewed":
        case "subscription.updated":
        case "subscription.plan_changed":
        case "subscription.cancelled":
        case "subscription.expired":
          return createSubscriptionEvents(event, webhookId);
        case "payment.succeeded":
          return createCheckoutEvents(event, webhookId);
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
        webhookKey: dodopaymentsOptions.webhookSecret,
      });

      return createDodopaymentsProvider(client, dodopaymentsOptions);
    },
  };
}
