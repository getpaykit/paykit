import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { toNextJsHandler } from "../handlers/next-js";
import { createPayKit, defineProvider } from "../index";
import { mockProvider } from "../test-utils/mock-provider";

function createTestPool(): Pool {
  const db = newDb();
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool & {
    connect: () => Promise<{
      query: (...args: unknown[]) => Promise<unknown>;
      release: () => void;
    }>;
    query: (...args: unknown[]) => Promise<unknown>;
  };

  const sanitizeQuery = (query: unknown): { rowMode: "array" | undefined; value: unknown } => {
    if (!query || typeof query === "string") {
      return { rowMode: undefined, value: query };
    }
    const { rowMode, types: _types, ...rest } = query as Record<string, unknown>;
    return {
      rowMode: rowMode === "array" ? "array" : undefined,
      value: rest,
    };
  };

  const getFieldNames = (query: unknown, result: unknown): string[] => {
    const queryText = typeof query === "string" ? query : (query as { text?: string }).text;

    if (queryText) {
      const selectMatch = queryText.match(/select\s+(.+?)\s+from\s/isu);
      const returningMatch = queryText.match(/returning\s+(.+)$/isu);
      const segment = selectMatch?.[1] ?? returningMatch?.[1];
      if (segment) {
        const matches = [...segment.matchAll(/"([^"]+)"/gu)];
        if (matches.length > 0) {
          return matches.map((match) => match[1]!);
        }
      }
    }

    const queryResult = result as { rows?: Array<Record<string, unknown>> };
    return queryResult.rows?.[0] ? Object.keys(queryResult.rows[0]) : [];
  };

  const adaptResult = (result: unknown, rowMode: "array" | undefined): unknown => {
    if (rowMode !== "array") {
      return result;
    }

    const queryResult = result as {
      rows?: Array<Record<string, unknown>>;
      fields?: Array<{ name: string }>;
    };
    const rows = queryResult.rows ?? [];
    const fieldNames = getFieldNames(currentQuery, result);

    return {
      ...queryResult,
      rows: rows.map((row) => fieldNames.map((fieldName) => row[fieldName])),
    };
  };

  let currentQuery: unknown;
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  pool.query = ((...args: unknown[]) => {
    const [query, ...rest] = args;
    currentQuery = query;
    const sanitized = sanitizeQuery(query);
    return originalQuery(sanitized.value, ...rest).then((result) =>
      adaptResult(result, sanitized.rowMode),
    );
  }) as typeof pool.query;

  const originalConnect = pool.connect.bind(pool);
  pool.connect = (async () => {
    const client = await originalConnect();
    const originalClientQuery = client.query.bind(client) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    client.query = ((...args: unknown[]) => {
      const [query, ...rest] = args;
      currentQuery = query;
      const sanitized = sanitizeQuery(query);
      return originalClientQuery(sanitized.value, ...rest).then((result) =>
        adaptResult(result, sanitized.rowMode),
      );
    }) as typeof client.query;
    return client;
  }) as typeof pool.connect;

  return pool as unknown as Pool;
}

async function getStoredCustomerId(pool: Pool, customerId: string): Promise<string> {
  const result = await pool.query("select id from paykit_customer where id = $1", [customerId]);
  const row = result.rows[0] as { id?: string } | undefined;
  if (!row?.id) {
    throw new Error(`Expected stored customer id for ${customerId}.`);
  }

  return row.id;
}

describe("paykit init", () => {
  it("should expose the MVP API shape", async () => {
    const paykit = createPayKit({
      database: createTestPool(),
      providers: [mockProvider()],
    });

    expect(typeof paykit.customer.sync).toBe("function");
    expect(typeof paykit.customer.get).toBe("function");
    expect(typeof paykit.customer.delete).toBe("function");

    expect(typeof paykit.checkout.create).toBe("function");

    expect(typeof paykit.paymentMethod.attach).toBe("function");
    expect(typeof paykit.paymentMethod.list).toBe("function");
    expect(typeof paykit.paymentMethod.setDefault).toBe("function");
    expect(typeof paykit.paymentMethod.detach).toBe("function");

    expect(typeof paykit.handleWebhook).toBe("function");
    expect(typeof paykit.asCustomer).toBe("function");

    const scoped = paykit.asCustomer({ id: "user_1" });
    expect(typeof scoped.checkout.create).toBe("function");
    expect(typeof scoped.paymentMethod.attach).toBe("function");
  });

  it("should expose next handler factory", () => {
    const paykit = createPayKit({
      database: createTestPool(),
      providers: [mockProvider()],
    });

    const handlers = toNextJsHandler(paykit);
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
  });

  it("should initialize context and sync schema on startup", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    const context = await paykit.$context;
    expect(context).toBeDefined();

    const result = await pool.query(`
      select distinct table_name
      from information_schema.tables
      where table_name in (
        'paykit_customer',
        'paykit_payment',
        'paykit_provider_customer',
        'paykit_payment_method'
      )
      order by table_name
    `);

    expect(result.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      "paykit_customer",
      "paykit_payment",
      "paykit_payment_method",
      "paykit_provider_customer",
    ]);
  });

  it("should initialize with Postgres storage and sync customers", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    const first = await paykit.customer.sync({
      id: "user_1",
      email: "one@example.com",
      name: "One",
    });
    const second = await paykit.customer.sync({
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

  it("should lazily create and reuse provider accounts for provider actions", async () => {
    const calls = {
      attachPaymentMethod: [] as string[],
      checkout: [] as string[],
      upsertCustomer: [] as string[],
    };

    const provider = defineProvider({
      id: "mock",

      async upsertCustomer(data) {
        calls.upsertCustomer.push(data.id);
        return { providerCustomerId: `provider_${data.id}` };
      },

      async checkout(data) {
        calls.checkout.push(data.providerCustomerId);
        return { url: "https://example.com/checkout/mock" };
      },

      async attachPaymentMethod(data) {
        calls.attachPaymentMethod.push(data.providerCustomerId);
        return { url: data.returnURL };
      },

      async detachPaymentMethod() {},

      async handleWebhook() {
        return [];
      },
    });

    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [provider],
    });

    const customer = await paykit.customer.sync({
      id: "user_1",
      email: "user@example.com",
      name: "User One",
    });

    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(0);

    await paykit.checkout.create({
      providerId: "mock",
      customerId: customer.id,
      amount: 9900,
      description: "Lifetime License",
      successURL: "https://example.com/success",
    });

    const providerCustomers = await pool.query(
      "select provider_customer_id from paykit_provider_customer",
    );
    expect(providerCustomers.rows).toHaveLength(1);
    expect(providerCustomers.rows[0]?.provider_customer_id).toBe("provider_user_1");
    expect(calls.upsertCustomer).toEqual(["user_1"]);
    expect(calls.checkout).toEqual(["provider_user_1"]);

    await paykit.paymentMethod.attach({
      customerId: customer.id,
      providerId: "mock",
      returnURL: "https://example.com/return",
    });

    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(1);
    expect(calls.upsertCustomer).toEqual(["user_1"]);
    expect(calls.attachPaymentMethod).toEqual(["provider_user_1"]);

    await paykit.customer.delete({ id: "user_1" });
    expect((await pool.query("select * from paykit_provider_customer")).rows).toHaveLength(1);
  });

  it("should use transactions in Postgres storage for setDefault", async () => {
    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      providers: [mockProvider()],
    });

    await paykit.customer.sync({
      id: "user_1",
      email: "user@example.com",
      name: "User",
    });

    const customer = await paykit.customer.get({ id: "user_1" });
    expect(customer).toBeTruthy();

    const storedCustomerId = await getStoredCustomerId(pool, "user_1");

    await pool.query(
      `
        insert into paykit_payment_method (
          id,
          customer_id,
          provider_id,
          provider_method_id,
          type,
          last4,
          expiry_month,
          expiry_year,
          is_default,
          deleted_at,
          created_at,
          updated_at
        )
        values
          ('pm_1', $1, 'mock', 'provider_pm_1', 'card', '1111', 1, 2030, true, null, now(), now()),
          ('pm_2', $1, 'mock', 'provider_pm_2', 'card', '2222', 2, 2031, false, null, now(), now())
      `,
      [storedCustomerId],
    );

    await paykit.paymentMethod.setDefault({
      customerId: "user_1",
      providerId: "mock",
      paymentMethodId: "pm_2",
    });

    const paymentMethods = await paykit.paymentMethod.list({
      customerId: "user_1",
      providerId: "mock",
    });

    expect(paymentMethods.find((method) => method.id === "pm_1")?.isDefault).toBe(false);
    expect(paymentMethods.find((method) => method.id === "pm_2")?.isDefault).toBe(true);
  });

  it("should fail when database setup is invalid", async () => {
    const paykit = createPayKit({
      database: {
        query: async () => {
          throw new Error("db unavailable");
        },
      } as unknown as Pool,
      providers: [mockProvider()],
    });

    await expect(paykit.$context).rejects.toThrow(/Failed query|db unavailable/);
  });

  it("should pass the raw request body string to providers through the next handler", async () => {
    let receivedBody = "";
    let receivedCustomerId = "";
    let catchAllEventName = "";

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

      async handleWebhook(data) {
        receivedBody = data.body;
        return [
          {
            name: "checkout.completed",
            payload: {
              checkoutSessionId: "cs_test_123",
              paymentStatus: "paid",
              providerCustomerId: "cus_user_1",
              status: "complete",
            },
          },
        ];
      },
    });

    const database = createTestPool();
    const paykit = createPayKit({
      database,
      providers: [provider],
      on: {
        "*": ({ event }) => {
          catchAllEventName = event.name;
        },
        "checkout.completed": ({ payload }) => {
          receivedCustomerId = payload.customer.id;
        },
      },
    });

    const customer = await paykit.customer.sync({
      id: "user_1",
    });

    await paykit.checkout.create({
      providerId: "stripe",
      customerId: customer.id,
      amount: 9900,
      description: "Lifetime License",
      successURL: "https://example.com/success",
    });

    const { POST } = toNextJsHandler(paykit);
    const response = await POST(
      new Request("https://example.com/api/pay/webhooks/stripe", {
        body: JSON.stringify({ id: "evt_test" }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(receivedBody).toBe('{"id":"evt_test"}');
    expect(receivedCustomerId).toBe("user_1");
    expect(catchAllEventName).toBe("checkout.completed");
  });

  it("should sync attached payment methods from webhooks and emit attached before checkout completion", async () => {
    const receivedEvents: string[] = [];

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

      async handleWebhook(data) {
        const body = JSON.parse(data.body) as { id: string };
        if (body.id === "evt_payment_1") {
          return [
            {
              actions: [
                {
                  data: {
                    paymentMethod: {
                      expiryMonth: 1,
                      expiryYear: 2030,
                      last4: "1111",
                      providerMethodId: "pm_provider_1",
                      type: "card",
                    },
                    providerCustomerId: "cus_user_1",
                  },
                  type: "payment_method.upsert",
                },
              ],
              name: "payment_method.attached",
              payload: {
                paymentMethod: {
                  expiryMonth: 1,
                  expiryYear: 2030,
                  last4: "1111",
                  providerMethodId: "pm_provider_1",
                  type: "card",
                },
                providerCustomerId: "cus_user_1",
              },
            },
            {
              actions: [
                {
                  data: {
                    payment: {
                      amount: 9900,
                      createdAt: new Date("2026-03-07T00:00:00.000Z"),
                      currency: "usd",
                      description: "Lifetime License",
                      metadata: {
                        source: "checkout",
                      },
                      providerMethodId: "pm_provider_1",
                      providerPaymentId: "pi_provider_1",
                      status: "succeeded",
                    },
                    providerCustomerId: "cus_user_1",
                  },
                  type: "payment.upsert",
                },
              ],
              name: "payment.succeeded",
              payload: {
                payment: {
                  amount: 9900,
                  createdAt: new Date("2026-03-07T00:00:00.000Z"),
                  currency: "usd",
                  description: "Lifetime License",
                  metadata: {
                    source: "checkout",
                  },
                  providerMethodId: "pm_provider_1",
                  providerPaymentId: "pi_provider_1",
                  status: "succeeded",
                },
                providerCustomerId: "cus_user_1",
              },
            },
            {
              name: "checkout.completed",
              payload: {
                checkoutSessionId: "cs_test_123",
                paymentStatus: "paid",
                providerCustomerId: "cus_user_1",
                status: "complete",
              },
            },
          ];
        }

        return [
          {
            actions: [
              {
                data: {
                  paymentMethod: {
                    expiryMonth: 2,
                    expiryYear: 2031,
                    last4: "2222",
                    providerMethodId: "pm_provider_2",
                    type: "card",
                  },
                  providerCustomerId: "cus_user_1",
                },
                type: "payment_method.upsert",
              },
            ],
            name: "payment_method.attached",
            payload: {
              paymentMethod: {
                expiryMonth: 2,
                expiryYear: 2031,
                last4: "2222",
                providerMethodId: "pm_provider_2",
                type: "card",
              },
              providerCustomerId: "cus_user_1",
            },
          },
        ];
      },
    });

    const pool = createTestPool();
    const paykit = createPayKit({
      database: pool,
      on: {
        "checkout.completed": () => {
          receivedEvents.push("checkout.completed");
        },
        "payment.succeeded": () => {
          receivedEvents.push("payment.succeeded");
        },
        "payment_method.attached": () => {
          receivedEvents.push("payment_method.attached");
        },
      },
      providers: [provider],
    });

    await paykit.customer.sync({
      id: "user_1",
    });
    await paykit.checkout.create({
      amount: 9900,
      customerId: "user_1",
      description: "Lifetime License",
      providerId: "stripe",
      successURL: "https://example.com/success",
    });

    await paykit.handleWebhook({
      body: JSON.stringify({ id: "evt_payment_1" }),
      headers: {},
      providerId: "stripe",
    });

    let methods = await paykit.paymentMethod.list({
      customerId: "user_1",
      providerId: "stripe",
    });
    expect(receivedEvents).toEqual([
      "payment_method.attached",
      "payment.succeeded",
      "checkout.completed",
    ]);
    expect(methods).toHaveLength(1);
    expect(methods[0]?.providerMethodId).toBe("pm_provider_1");
    expect(methods[0]?.isDefault).toBe(true);

    const payments = await pool.query(
      "select provider_payment_id, payment_method_id, status from paykit_payment where customer_id = $1",
      ["user_1"],
    );
    expect(payments.rows).toEqual([
      {
        payment_method_id: methods[0]?.id,
        provider_payment_id: "pi_provider_1",
        status: "succeeded",
      },
    ]);

    await paykit.handleWebhook({
      body: JSON.stringify({ id: "evt_payment_2" }),
      headers: {},
      providerId: "stripe",
    });

    methods = await paykit.paymentMethod.list({
      customerId: "user_1",
      providerId: "stripe",
    });
    expect(methods).toHaveLength(2);
    expect(methods.find((method) => method.providerMethodId === "pm_provider_1")?.isDefault).toBe(
      false,
    );
    expect(methods.find((method) => method.providerMethodId === "pm_provider_2")?.isDefault).toBe(
      true,
    );
  });

  it("should soft-delete detached payment methods and promote the newest remaining default", async () => {
    let detachedPaymentMethodId = "";
    let detachedPaymentMethodIsDefault = true;
    let detachedPaymentMethodDeletedAt: Date | null = null;

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

      async handleWebhook(data) {
        const body = JSON.parse(data.body) as { id: string };
        if (body.id === "evt_attach_1") {
          return [
            {
              actions: [
                {
                  data: {
                    paymentMethod: {
                      providerMethodId: "pm_provider_1",
                      type: "card",
                    },
                    providerCustomerId: "cus_user_1",
                  },
                  type: "payment_method.upsert",
                },
              ],
              name: "payment_method.attached",
              payload: {
                paymentMethod: {
                  providerMethodId: "pm_provider_1",
                  type: "card",
                },
                providerCustomerId: "cus_user_1",
              },
            },
          ];
        }

        if (body.id === "evt_attach_2") {
          return [
            {
              actions: [
                {
                  data: {
                    paymentMethod: {
                      providerMethodId: "pm_provider_2",
                      type: "card",
                    },
                    providerCustomerId: "cus_user_1",
                  },
                  type: "payment_method.upsert",
                },
              ],
              name: "payment_method.attached",
              payload: {
                paymentMethod: {
                  providerMethodId: "pm_provider_2",
                  type: "card",
                },
                providerCustomerId: "cus_user_1",
              },
            },
          ];
        }

        return [
          {
            actions: [
              {
                data: {
                  providerMethodId: "pm_provider_2",
                },
                type: "payment_method.delete",
              },
            ],
            name: "payment_method.detached",
            payload: {
              providerMethodId: "pm_provider_2",
            },
          },
        ];
      },
    });

    const paykit = createPayKit({
      database: createTestPool(),
      on: {
        "payment_method.detached": ({ payload }) => {
          detachedPaymentMethodDeletedAt = payload.paymentMethod.deletedAt;
          detachedPaymentMethodId = payload.paymentMethod.providerMethodId;
          detachedPaymentMethodIsDefault = payload.paymentMethod.isDefault;
        },
      },
      providers: [provider],
    });

    await paykit.customer.sync({
      id: "user_1",
    });
    await paykit.checkout.create({
      amount: 9900,
      customerId: "user_1",
      description: "Lifetime License",
      providerId: "stripe",
      successURL: "https://example.com/success",
    });

    await paykit.handleWebhook({
      body: JSON.stringify({ id: "evt_attach_1" }),
      headers: {},
      providerId: "stripe",
    });
    await paykit.handleWebhook({
      body: JSON.stringify({ id: "evt_attach_2" }),
      headers: {},
      providerId: "stripe",
    });
    await paykit.handleWebhook({
      body: JSON.stringify({ id: "evt_detach_2" }),
      headers: {},
      providerId: "stripe",
    });

    const methods = await paykit.paymentMethod.list({
      customerId: "user_1",
      providerId: "stripe",
    });

    expect(detachedPaymentMethodId).toBe("pm_provider_2");
    expect(detachedPaymentMethodIsDefault).toBe(false);
    expect(detachedPaymentMethodDeletedAt).toBeInstanceOf(Date);
    expect(methods).toHaveLength(1);
    expect(methods[0]?.providerMethodId).toBe("pm_provider_1");
    expect(methods[0]?.isDefault).toBe(true);
  });
});
