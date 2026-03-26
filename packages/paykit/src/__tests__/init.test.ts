import { describe, expect, expectTypeOf, it } from "vitest";

import { createPayKitClient } from "../client/index";
import { isPayKitInstance } from "../core/create-paykit";
import { paykitHandler } from "../handlers/next";
import { createPayKit, feature, plan } from "../index";
import { createMigratedTestPool, createTestPool, mockProvider } from "../test-utils/index";

describe("paykit init", () => {
  it("should expose the new API shape", async () => {
    const paykit = createPayKit({
      database: createTestPool(),
      provider: mockProvider(),
    });

    expect(typeof paykit.handler).toBe("function");
    expect(typeof paykit.subscribe).toBe("function");
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

  it("should infer subscribe plan ids from exported plans", () => {
    const messagesFeature = feature({
      id: "messages",
      type: "metered",
    });
    const free = plan({
      default: true,
      group: "base",
      id: "free",
      includes: [messagesFeature({ limit: 50, reset: "month" })],
    });
    const proMonthly = plan({
      group: "base",
      id: "pro_monthly",
      includes: [messagesFeature({ limit: 1000, reset: "month" })],
      price: { amount: 19.9, interval: "month" },
    });
    const plans = { free, proMonthly } as const;

    const paykit = createPayKit({
      database: createTestPool(),
      plans,
      provider: mockProvider(),
    });
    const paykitClient = createPayKitClient<typeof paykit>();

    type SubscribeInput = Parameters<typeof paykit.subscribe>[0];
    type ApiSubscribeInput = Parameters<typeof paykit.api.subscribe>[0]["body"];
    type ClientSubscribeInput = Parameters<typeof paykitClient.subscribe>[0];

    expectTypeOf<SubscribeInput["planId"]>().toEqualTypeOf<"free" | "pro_monthly">();
    expectTypeOf<ApiSubscribeInput["planId"]>().toEqualTypeOf<"free" | "pro_monthly">();
    expectTypeOf<ClientSubscribeInput["planId"]>().toEqualTypeOf<"free" | "pro_monthly">();

    const validSubscribePlanId: SubscribeInput["planId"] = "free";
    const validClientPlanId: ClientSubscribeInput["planId"] = "pro_monthly";
    expect(validSubscribePlanId).toBe("free");
    expect(validClientPlanId).toBe("pro_monthly");

    // @ts-expect-error Unknown ids should be rejected when plans are configured statically.
    const invalidClientPlanId: ClientSubscribeInput["planId"] = "enterprise";
    expect(invalidClientPlanId).toBe("enterprise");
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
        'paykit_feature',
        'paykit_payment',
        'paykit_product',
        'paykit_price',
        'paykit_provider_customer',
        'paykit_provider_price',
        'paykit_provider_product',
        'paykit_payment_method'
      )
      order by table_name
    `);

    expect(result.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      "paykit_customer",
      "paykit_feature",
      "paykit_payment",
      "paykit_payment_method",
      "paykit_price",
      "paykit_product",
      "paykit_provider_customer",
      "paykit_provider_price",
      "paykit_provider_product",
    ]);
  });

  it("should pass the raw request body string to provider through the next handler", async () => {
    let receivedBody = "";

    const provider = mockProvider({
      id: "stripe",
      runtime: {
        async handleWebhook(data) {
          receivedBody = data.body;
          return [];
        },
      },
    });

    const database = await createMigratedTestPool();
    const paykit = createPayKit({
      database,
      provider,
    });

    const { POST } = paykitHandler(paykit);
    const response = await POST(
      new Request("https://example.com/paykit/api/webhook/stripe", {
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
    const provider = mockProvider({
      id: "stripe",
      runtime: {
        async handleWebhook() {
          return [
            {
              actions: [
                {
                  data: {
                    email: "webhook@example.com",
                    id: "user_webhook",
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
