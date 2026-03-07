import { createPayKit, defineProvider } from "paykitjs";
import { Pool } from "pg";

import { env } from "@/env";

const mockProvider = defineProvider({
  id: "mock",

  async upsertCustomer(data) {
    return {
      providerCustomerId: `mock_cust_${data.referenceId}`,
    };
  },

  async checkout(data) {
    const url = new URL("https://example.com/checkout/mock");
    url.searchParams.set("customer", data.providerCustomerId);
    url.searchParams.set("amount", String(data.amount));
    url.searchParams.set("description", data.description);

    return { url: url.toString() };
  },

  async attachPaymentMethod(data) {
    return { url: data.returnURL };
  },

  async detachPaymentMethod() {},

  async handleWebhook() {
    return {
      name: "webhook.received",
      payload: {
        providerId: "mock",
      },
    };
  },
});

const providers = [mockProvider] as const;

function createPayKitInstance(pool: Pool) {
  return createPayKit({
    database: pool,
    providers,
  });
}

type AppPayKit = ReturnType<typeof createPayKitInstance>;

const globalForPayKit = globalThis as typeof globalThis & {
  paykitPool?: Pool;
  paykitInstance?: AppPayKit;
};

const pool =
  globalForPayKit.paykitPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

const paykit = globalForPayKit.paykitInstance ?? createPayKitInstance(pool);

if (process.env.NODE_ENV !== "production") {
  globalForPayKit.paykitPool = pool;
  globalForPayKit.paykitInstance = paykit;
}

export { paykit };
