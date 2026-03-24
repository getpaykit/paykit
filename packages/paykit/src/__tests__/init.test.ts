import { describe, expect, expectTypeOf, it } from "vitest";

import { createPayKitClient } from "../client/index";
import { isPayKitInstance } from "../core/create-paykit";
import { paykitHandler } from "../handlers/next";
import { createPayKit, defineProvider, product } from "../index";
import { createMigratedTestPool, createTestPool, mockProvider } from "../test-utils/index";

describe("paykit init", () => {
  it("should expose the new API shape", async () => {
    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
    });

    expect(typeof paykit.handler).toBe("function");
    expect(typeof paykit.checkout).toBe("function");
    expect(typeof paykit.handleWebhook).toBe("function");
    expect(paykit.api).toBeDefined();
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

  it("should infer checkout product ids from configured products", () => {
    const starterPack = product({
      id: "starter_pack",
      name: "Starter Pack",
      price: { amount: 9.9 },
    });
    const proMonthly = product({
      id: "pro_monthly",
      name: "Pro Monthly",
      price: { amount: 19.9, interval: "month" },
    });

    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
      products: [starterPack, proMonthly],
    });
    const paykitClient = createPayKitClient<typeof paykit>();

    type CheckoutInput = Parameters<typeof paykit.checkout>[0];
    type ApiCheckoutInput = Parameters<typeof paykit.api.checkout>[0]["body"];
    type ClientCheckoutInput = Parameters<typeof paykitClient.checkout>[0];

    expectTypeOf<CheckoutInput["productId"]>().toEqualTypeOf<
      "starter_pack" | "pro_monthly"
    >();
    expectTypeOf<ApiCheckoutInput["productId"]>().toEqualTypeOf<
      "starter_pack" | "pro_monthly"
    >();
    expectTypeOf<ClientCheckoutInput["productId"]>().toEqualTypeOf<
      "starter_pack" | "pro_monthly"
    >();

    const validCheckoutProductId: CheckoutInput["productId"] = "starter_pack";
    const validClientProductId: ClientCheckoutInput["productId"] = "pro_monthly";
    expect(validCheckoutProductId).toBe("starter_pack");
    expect(validClientProductId).toBe("pro_monthly");

    // @ts-expect-error Unknown ids should be rejected when products are configured statically.
    const invalidClientProductId: ClientCheckoutInput["productId"] = "enterprise";
    expect(invalidClientProductId).toBe("enterprise");
  });

  it("should brand paykit instances for internal detection", () => {
    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
    });

    expect(isPayKitInstance(paykit)).toBe(true);
    expect(isPayKitInstance({ options: paykit.options })).toBe(false);
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
});
