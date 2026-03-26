import type { StripeProviderConfig, StripeRuntime } from "../providers/provider";

export function mockProvider(input?: {
  id?: string;
  runtime?: Partial<StripeRuntime>;
}): StripeProviderConfig {
  const runtime: StripeRuntime = {
    async upsertCustomer(data) {
      return { providerCustomerId: `mock_cus_${data.id}` };
    },

    async attachPaymentMethod(data) {
      return { url: data.returnURL };
    },

    async createSubscriptionCheckout(data) {
      return {
        paymentUrl: `https://example.com/checkout/subscription?price=${data.providerPriceId}`,
        providerCheckoutSessionId: `cs_${data.providerPriceId}`,
      };
    },

    async createSubscription(data) {
      return {
        invoice: {
          currency: "usd",
          hostedUrl: "https://example.com/invoices/inv_mock",
          providerInvoiceId: `inv_${data.providerPriceId}`,
          status: "paid",
          totalAmount: 2_000,
        },
        paymentUrl: null,
        requiredAction: null,
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEndAt: new Date("2026-04-08T00:00:00.000Z"),
          currentPeriodStartAt: new Date("2026-03-08T00:00:00.000Z"),
          providerSubscriptionId: `sub_${data.providerPriceId}`,
          status: "active",
        },
      };
    },

    async updateSubscription(data) {
      return {
        invoice: {
          currency: "usd",
          hostedUrl: "https://example.com/invoices/inv_mock_upgrade",
          providerInvoiceId: `inv_${data.providerPriceId}`,
          status: "paid",
          totalAmount: 3_000,
        },
        paymentUrl: null,
        requiredAction: null,
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEndAt: new Date("2026-04-08T00:00:00.000Z"),
          currentPeriodStartAt: new Date("2026-03-08T00:00:00.000Z"),
          providerSubscriptionId: data.providerSubscriptionId,
          status: "active",
        },
      };
    },

    async scheduleSubscriptionChange(data) {
      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: {
          cancelAtPeriodEnd: false,
          providerPriceId: data.providerPriceId ?? null,
          providerSubscriptionId: data.providerSubscriptionId,
          providerSubscriptionScheduleId: `sched_${data.providerSubscriptionId}`,
          status: "active",
        },
      };
    },

    async cancelSubscription(data) {
      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: {
          cancelAtPeriodEnd: true,
          providerSubscriptionId: data.providerSubscriptionId,
          providerSubscriptionScheduleId: null,
          status: "active",
        },
      };
    },

    async resumeSubscription(data) {
      return {
        paymentUrl: null,
        requiredAction: null,
        subscription: {
          cancelAtPeriodEnd: false,
          providerSubscriptionId: data.providerSubscriptionId,
          providerSubscriptionScheduleId: null,
          status: "active",
        },
      };
    },

    async detachPaymentMethod() {},

    async createInvoice(data) {
      return {
        currency: "usd",
        hostedUrl: "https://example.com/invoices/inv_manual_mock",
        providerInvoiceId: `inv_manual_${data.providerCustomerId}`,
        status: "paid",
        totalAmount: data.lines.reduce((sum, line) => sum + line.amount, 0),
      };
    },

    async charge(data) {
      return {
        amount: data.amount,
        createdAt: new Date("2026-03-08T00:00:00.000Z"),
        currency: "usd",
        description: data.description,
        metadata: data.metadata,
        providerMethodId: data.providerMethodId,
        providerPaymentId: `pay_${data.providerMethodId}`,
        status: "succeeded",
      };
    },

    async syncProduct(data) {
      return {
        providerProductId: `mock_prod_${data.id}`,
        providerPriceId: `mock_price_${data.id}_${String(data.priceAmount)}`,
      };
    },

    async handleWebhook() {
      return [];
    },

    async createPortalSession(data) {
      return { url: `https://example.com/portal?customer=${data.providerCustomerId}` };
    },
  };

  return {
    id: input?.id ?? "mock",
    kind: "stripe",
    runtime: {
      ...runtime,
      ...input?.runtime,
    },
    secretKey: "sk_test_123",
    webhookSecret: "whsec_test_123",
  };
}
