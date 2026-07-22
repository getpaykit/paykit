import {
  PAYKIT_ERROR_CODES,
  PayKitError,
  type NormalizedWebhookEvent,
  type PayKitProviderConfig,
  type PaymentProvider,
} from "paykitjs";
import Razorpay from "razorpay";
import type { Invoices } from "razorpay/dist/types/invoices";
import type { Payments } from "razorpay/dist/types/payments";
import type { Subscriptions } from "razorpay/dist/types/subscriptions";

export interface RazorpayOptions {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export type RazorpayProviderConfig = PayKitProviderConfig & {
  capabilities: { testClocks: false };
};

type RazorpaySubscription = Subscriptions.RazorpaySubscription;
type RazorpayPayment = Payments.RazorpayPayment;
type RazorpayInvoice = Invoices.RazorpayInvoice;

type RazorpayWebhookEvent = {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    subscription?: { entity: RazorpaySubscription };
    invoice?: { entity: RazorpayInvoice };
  };
  contains?: string[];
  created_at: number;
  account_id?: string;
};

function notSupported(method: string): never {
  throw PayKitError.from(
    "BAD_REQUEST",
    PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
    `${method} is not supported by the Razorpay provider.`,
  );
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value) * 1000);
  }

  return new Date(value);
}

function normalizeRazorpaySubscription(sub: RazorpaySubscription) {
  return {
    cancelAtPeriodEnd: false, // by default keeping this false, as in razorpay there's no way of fetching this field. We may need to store this internally in the db.
    canceledAt: toDate(sub.end_at),
    currentPeriodEndAt: toDate(sub.current_end),
    currentPeriodStartAt: toDate(sub.current_start),
    endedAt: toDate(sub.ended_at),
    providerProduct: { productId: sub.plan_id },
    providerSubscriptionId: sub.id,
    providerSubscriptionScheduleId: null,
    status: sub.status,
  };
}

function normalizeRazorpayInvoice(invoice: RazorpayInvoice) {
  return {
    currency: invoice.currency ?? "INR", // It seems we need to include currency attribute in data object
    hostedUrl: invoice.short_url,
    periodEndAt: null,
    periodStartAt: null,
    providerInvoiceId: invoice.id,
    status: invoice.status ?? null,
    totalAmount: Number(invoice.amount) ?? 0,
  };
}

function createSubscriptionEvents(
  event: { type?: string; data: RazorpaySubscription },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const sub = event.data;
  const normalized = normalizeRazorpaySubscription(sub);

  const providerCustomerId = sub.customer_id;
  if (!providerCustomerId) return [];

  if (event.type === "subscription.cancelled") {
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
  event: { type?: string; data: RazorpayPayment },
  webhookId: string,
): NormalizedWebhookEvent[] {
  const payment = event.data;
  if (payment.status !== "captured") return [];

  const providerCustomerId = payment.customer_id;
  if (!providerCustomerId) return [];

  return [
    {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: payment.id,
        mode: "subscription",
        paymentStatus: "paid",
        providerCustomerId,
        providerEventId: webhookId,
        providerSubscriptionId: payment.subscription_id ?? undefined,
        status: payment.status,
        metadata: payment.notes
          ? Object.fromEntries(Object.entries(payment.notes).map(([k, v]) => [k, String(v)]))
          : undefined,
      },
    },
  ];
}

export function createRazorpayProvider(
  client: Razorpay,
  options: RazorpayOptions,
): PaymentProvider {
  return {
    id: "razorpay",
    name: "Razorpay",
    capabilities: { testClocks: false },

    async createCustomer(data) {
      if (!data.email) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Razorpay requires a non-empty email to create a customer",
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
          notes: customerMetadata,
          fail_existing: 0,
        });

        await client.customers.edit(customer.id, {
          email: data.email,
          name: data.name,
        });

        return {
          providerCustomer: { id: customer.id },
        };
      } catch (error) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED,
          "Failed to create or find customer on Razorpay",
        );
      }
    },

    async updateCustomer(data) {
      await client.customers.edit(data.providerCustomerId, {
        email: data.email,
        name: data.name,
      });
    },

    async deleteCustomer(data) {
      notSupported("deleteCustomer");
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
      const checkout = await client.subscriptions.create({
        plan_id: data.providerProduct.plan_id!,
        total_count: 1, // for now set to 1, as paykit doesnt support this prop
      });

      if (!checkout.short_url) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SESSION_INVALID);
      }

      return {
        paymentUrl: checkout.short_url,
        providerCheckoutSessionId: checkout.id,
      };
    },

    createSubscription() {
      return notSupported("createSubscription (use checkout instead)");
    },

    async updateSubscription(data) {
      const sub = await client.subscriptions.update(data.providerSubscriptionId, {
        plan_id: data.providerProduct.plan_id!,
        schedule_change_at: "now",
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: false, // razorpay don't have option to track this, we need to rely on webhooks
          currentPeriodEndAt: toDate(sub.current_end),
          currentPeriodStartAt: toDate(sub.current_start),
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    async createInvoice(data) {
      const currency = "INR";
      const razorpayInvoice = await client.invoices.create({
        type: "invoice",
        customer_id: data.providerCustomerId,
        currency,
        line_items: data.lines.map((line) => ({
          amount: line.amount,
          currency,
          description: line.description,
          quantity: 1,
        })),
        draft: data.autoAdvance === false ? "1" : undefined,
        sms_notify: 1,
        email_notify: 1,
      });

      return normalizeRazorpayInvoice(razorpayInvoice);
    },

    async scheduleSubscriptionChange(data) {
      // const current = await client.subscriptions.fetch(data.providerSubscriptionId);

      // no way of getting this in razorpay or we can give true by default
      // const wasCanceled = current
      notSupported("scheduleSubscriptionChange");
    },

    async cancelSubscription(data) {
      const sub = await client.subscriptions.cancel(data.providerSubscriptionId, true);

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: true,
          currentPeriodEndAt: toDate(sub.current_end),
          currentPeriodStartAt: toDate(sub.current_start),
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    async listActiveSubscriptions(data) {
      const result = await client.subscriptions.all();

      return (result.items ?? [])
        .filter((sub) => sub.status === "active" && sub.customer_id === data.providerCustomerId)
        .map((sub) => ({ providerSubscriptionId: sub.id }));
    },

    async resumeSubscription(data) {
      const sub = await client.subscriptions.resume(data.providerSubscriptionId, {
        resume_at: "now",
      });

      return {
        paymentUrl: null,
        subscription: {
          cancelAtPeriodEnd: false, // no way in razorpay to fetch this via flag,
          currentPeriodEndAt: toDate(sub.current_end),
          currentPeriodStartAt: toDate(sub.current_start),
          providerSubscriptionId: sub.id,
          status: sub.status,
        },
      };
    },

    detachPaymentMethod() {
      return notSupported("detachPaymentMethod");
    },

    syncProducts() {
      return notSupported("syncProducts");
    },

    async handleWebhook(data): Promise<NormalizedWebhookEvent[]> {
      const signatureHeader = Object.keys(data.headers).find(
        (key) => key.toLowerCase() === "x-razorpay-signature",
      );
      const signature = signatureHeader ? data.headers[signatureHeader]! : "";

      const eventIdHeader = Object.keys(data.headers).find(
        (key) => key.toLowerCase() === "x-razorpay-event-id",
      );
      const eventId = eventIdHeader ? data.headers[eventIdHeader]! : "";

      if (!signature) {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING);
      }

      const isValid = Razorpay.validateWebhookSignature(
        data.body,
        signature,
        options.webhookSecret,
      );
      if (!isValid) {
        throw PayKitError.from(
          "BAD_REQUEST",
          PAYKIT_ERROR_CODES.PROVIDER_SIGNATURE_MISSING,
          "Invalid Razorpay webhook signature",
        );
      }

      let event: RazorpayWebhookEvent;
      try {
        event = JSON.parse(data.body) as RazorpayWebhookEvent;
      } catch {
        throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_WEBHOOK_INVALID);
      }

      const events: NormalizedWebhookEvent[] = [];

      if (event.payload.subscription?.entity) {
        events.push(
          ...createSubscriptionEvents(
            { type: event.event, data: event.payload.subscription.entity },
            eventId,
          ),
        );
      }

      if (event.payload.payment?.entity) {
        events.push(
          ...createCheckoutEvents(
            { type: event.event, data: event.payload.payment.entity },
            eventId,
          ),
        );
      }

      return events;
    },

    createPortalSession() {
      return notSupported("createPortalSession");
    },

    async check() {
      const mode = options.keyId.startsWith("rzp_test_") ? "test mode" : "live mode";

      try {
        let webhookEndpoints: Array<{ url: string; status: string }> = [];
        try {
          const webhooks = await client.webhooks.all({ count: 50 });
          webhookEndpoints = (webhooks.items ?? []).map((webhook) => ({
            url: webhook.url,
            status: webhook.active ? "active" : "inactive",
          }));
        } catch {
          // webhook listing may fail with restricted keys
        }

        const customers = await client.customers.all({ count: 5 });
        const customerSample = (customers.items ?? []).map((customer) => {
          const notes = customer.notes as Record<string, unknown> | undefined;
          const paykitCustomerId =
            notes && typeof notes.paykitCustomerId === "string" ? notes.paykitCustomerId : null;

          return {
            providerEmail: customer.email ?? "",
            paykitCustomerId,
          };
        });

        return {
          ok: true,
          displayName: "Razorpay",
          mode,
          webhookEndpoints,
          customerSample,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          displayName: "Razorpay",
          mode,
          error: message,
        };
      }
    },
  };
}

export function razorpay(razorpayOptions: RazorpayOptions): RazorpayProviderConfig {
  return {
    id: "razorpay",
    name: "Razorpay",
    capabilities: { testClocks: false },
    createAdapter(): PaymentProvider {
      const client = new Razorpay({
        key_id: razorpayOptions.keyId,
        key_secret: razorpayOptions.keySecret,
      });
      return createRazorpayProvider(client, razorpayOptions);
    },
  };
}
