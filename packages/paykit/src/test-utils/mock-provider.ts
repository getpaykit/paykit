import { defineProvider } from "../providers/provider";

export function mockProvider() {
  return defineProvider({
    id: "mock",

    async upsertCustomer(data) {
      return { providerCustomerId: `mock_cus_${data.id}` };
    },

    async checkout() {
      return { url: "https://example.com/checkout/mock" };
    },

    async attachPaymentMethod(data) {
      return { url: data.returnURL };
    },

    async detachPaymentMethod() {},

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
  });
}
