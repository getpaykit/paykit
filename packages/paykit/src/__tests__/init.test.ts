import type { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { paykitHandler } from "../handlers/next";
import { createPayKit, defineProvider } from "../index";
import { createMigratedTestPool, createTestPool, mockProvider } from "../test-utils/index";

describe("paykit init", () => {
  it("should expose the new API shape", async () => {
    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
    });

    expect(typeof paykit.customers.create).toBe("function");
    expect(typeof paykit.customers.get).toBe("function");
    expect(typeof paykit.customers.delete).toBe("function");
    expect(typeof paykit.handleWebhook).toBe("function");
  });

  it("should expose next handler factory", () => {
    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
    });

    const handlers = paykitHandler(paykit);
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
  });

  it("should initialize context lazily without requiring migrations to run first", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      provider: mockProvider(),
    });

    await expect(paykit.$context).resolves.toBeDefined();
  });

  it("should initialize context after migrations have run", async () => {
    const pool = await createMigratedTestPool();
    const paykit = createPayKit({
      database: pool,
      provider: mockProvider(),
    });

    const context = await paykit.$context;
    expect(context).toBeDefined();

    const result = await pool.query(`
      select distinct table_name
      from information_schema.tables
      where table_name in (
        'paykit_customer',
        'paykit_payment',
        'paykit_product',
        'paykit_provider_customer',
        'paykit_payment_method'
      )
      order by table_name
    `);

    expect(result.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      "paykit_customer",
      "paykit_payment",
      "paykit_payment_method",
      "paykit_product",
      "paykit_provider_customer",
    ]);
  });

  it("should sync customers with create and update on second call", async () => {
    const pool = await createMigratedTestPool();
    const paykit = createPayKit({
      database: pool,
      provider: mockProvider(),
    });

    const first = await paykit.customers.create({
      id: "user_1",
      email: "one@example.com",
      name: "One",
    });
    const second = await paykit.customers.create({
      id: "user_1",
      email: "two@example.com",
    });

    expect(first.id).toBe("user_1");
    expect(second.id).toBe("user_1");
    expect(second.email).toBe("two@example.com");
    expect(second.name).toBe("One");

    const rows = await pool.query("select id from paykit_customer where id = $1", ["user_1"]);
    expect(rows.rows).toHaveLength(1);
  });

  it("should get and delete customers", async () => {
    const pool = await createMigratedTestPool();
    const paykit = createPayKit({
      database: pool,
      provider: mockProvider(),
    });

    await paykit.customers.create({
      id: "user_1",
      email: "user@example.com",
      name: "User",
    });

    const customer = await paykit.customers.get({ id: "user_1" });
    expect(customer).toBeTruthy();
    expect(customer?.email).toBe("user@example.com");

    await paykit.customers.delete({ id: "user_1" });

    const deleted = await paykit.customers.get({ id: "user_1" });
    expect(deleted).toBeNull();
  });

  it("should pass the raw request body string to provider through the next handler", async () => {
    let receivedBody = "";

    const provider = defineProvider({
      id: "stripe",

      async upsertCustomer(data) {
        return { providerCustomerId: `cus_${data.id}` };
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
          providerMethodId: data.providerMethodId,
          providerPaymentId: "pi_test_123",
          status: "succeeded",
        };
      },

      async syncProduct(data) {
        return { providerProductId: `prod_${data.id}`, providerPriceId: `price_${data.id}` };
      },

      async handleWebhook(data) {
        receivedBody = data.body;
        return [];
      },
    });

    const database = await createMigratedTestPool();
    const paykit = createPayKit({
      database,
      provider,
    });

    const { POST } = paykitHandler(paykit);
    const response = await POST(
      new Request("https://example.com/api/paykit/webhook", {
        body: JSON.stringify({ id: "evt_test" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(receivedBody).toBe('{"id":"evt_test"}');
  });

  it("should apply customer actions from webhooks", async () => {
    const provider = defineProvider({
      id: "stripe",

      async upsertCustomer(data) {
        return { providerCustomerId: `cus_${data.id}` };
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
          providerMethodId: data.providerMethodId,
          providerPaymentId: "pi_test_123",
          status: "succeeded",
        };
      },

      async syncProduct(data) {
        return { providerProductId: `prod_${data.id}`, providerPriceId: `price_${data.id}` };
      },

      async handleWebhook() {
        return [
          {
            actions: [
              {
                data: {
                  id: "user_webhook",
                  email: "webhook@example.com",
                  name: "Webhook User",
                },
                type: "customer.upsert" as const,
              },
            ],
            name: "checkout.completed" as const,
            payload: {
              checkoutSessionId: "cs_test_123",
              paymentStatus: "paid",
              providerCustomerId: "cus_user_webhook",
              status: "complete",
            },
          },
        ];
      },
    });

    const pool = await createMigratedTestPool();
    const paykit = createPayKit({
      database: pool,
      provider,
    });

    await paykit.handleWebhook({
      body: "{}",
      headers: {},
    });

    const rows = await pool.query("select id, email from paykit_customer where id = $1", [
      "user_webhook",
    ]);
    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0] as { email: string }).email).toBe("webhook@example.com");
  });

  it("should fail when a database query cannot be executed", async () => {
    const paykit = createPayKit({
      database: {
        connect: async () => {
          throw new Error("db unavailable");
        },
        query: async () => {
          throw new Error("db unavailable");
        },
      } as unknown as Pool,
      provider: mockProvider(),
    });

    await expect(paykit.$context).resolves.toBeDefined();
    await expect(
      paykit.customers.create({
        id: "user_1",
        email: "user@example.com",
      }),
    ).rejects.toThrow(/Failed query|db unavailable/);
  });
});
