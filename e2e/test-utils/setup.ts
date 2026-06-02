import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { and, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { createPayKit } from "paykitjs";
import { Pool } from "pg";
import { default as Stripe } from "stripe";

import type { PayKitContext } from "../../packages/paykit/src/core/context";
import type { PayKitDatabase } from "../../packages/paykit/src/database/index";
import { migrateDatabase } from "../../packages/paykit/src/database/index";
import {
  customer,
  invoice,
  product,
  subscription,
  webhookEvent,
} from "../../packages/paykit/src/database/schema";
import { syncPaymentMethodByProviderCustomer } from "../../packages/paykit/src/payment-method/payment-method.service";
import { syncProducts } from "../../packages/paykit/src/product/product-sync.service";
import { env } from "./env";
import { loadHarness } from "./harness/index";
import type { ProviderHarness } from "./harness/types";
import { HUB_PORT, registerCustomer, unregisterCustomers } from "./hub";
import { allProducts } from "./products";

// Provider harness — loaded once at module init based on PROVIDER env var
export const harness: ProviderHarness = loadHarness();

type TestPayKitInstance = ReturnType<
  typeof createPayKit<{
    database: Pool;
    products: typeof allProducts;
    stripe: ReturnType<typeof harness.createStripeOptions>;
    testing: { enabled: true };
  }>
>;

export interface TestPayKit {
  paykit: TestPayKitInstance;
  database: PayKitDatabase;
  ctx: PayKitContext;
  harness: ProviderHarness;
  dbPath: string;
  server: Server;
  workerUrl: string;
  webhookRequests: CapturedWebhookRequest[];
  cleanup: () => Promise<void>;
}

export interface CapturedWebhookRequest {
  body: string;
  headers: Record<string, string>;
  path: string;
  receivedAt: Date;
}

const activeSubscriptionStatuses = ["active", "trialing", "past_due"] as const;
const presentSubscriptionStatuses = [...activeSubscriptionStatuses, "scheduled"] as const;

function buildUniqueTestEmail(input: { email: string; suffix: string }): string {
  const [localPart, domain = ""] = input.email.split("@");
  if (!localPart || !domain) {
    throw new Error(`Invalid test email: ${input.email}`);
  }

  const uniqueLocalPart = `${localPart}+${input.suffix}`;

  return `${uniqueLocalPart}@e2e.paykit.sh`;
}

export async function createTestPayKit(): Promise<TestPayKit> {
  harness.validateEnv();

  // 1. Create a fresh test database
  const dbName = `paykit_test_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`;
  const adminPool = new Pool({
    connectionString: env.TEST_DATABASE_URL,
  });
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  await adminPool.end();

  const dbUrl = env.TEST_DATABASE_URL.replace(/\/[^/]*$/, `/${dbName}`);
  const pool = new Pool({ connectionString: dbUrl });

  // 2. Run migrations
  await migrateDatabase(pool);

  // 3. Create PayKit instance with the active provider
  const stripeOptions = harness.createStripeOptions();
  const paykit = createPayKit({
    database: pool,
    products: allProducts,
    stripe: stripeOptions,
    testing: { enabled: true },
  });

  const ctx = await paykit.$context;

  // Provider-specific testing overrides (e.g., Stripe allow_incomplete)
  harness.applyTestingOverrides?.(ctx);

  // 4. Start per-test webhook server on a random free port. A shared hub on 4567
  // (started in globalSetup) forwards webhooks to this worker by provider customer ID.
  const webhookRequests: CapturedWebhookRequest[] = [];
  const { server, workerUrl } = await startWebhookServer(paykit, webhookRequests);

  // 5. Sync products to provider. These fire product.created/price.created events
  // which the hub drops (they don't carry a customer ID) — safe to run before
  // any customer is registered.
  await syncProducts(ctx);

  return {
    paykit,
    database: ctx.database,
    ctx,
    harness,
    dbPath: dbUrl,
    server,
    workerUrl,
    webhookRequests,
    cleanup: async () => {
      const customerRows = await ctx.database.query.customer.findMany();
      const idSet = new Set<string>();
      for (const row of customerRows) {
        if (row.stripeCustomerId) idSet.add(row.stripeCustomerId);
      }

      await harness.cleanup({ providerCustomerIds: [...idSet] });

      // Wait for cleanup webhooks to arrive and be processed
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      await unregisterCustomers([...idSet]);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
      // Drop the test database
      const cleanupPool = new Pool({
        connectionString: env.TEST_DATABASE_URL,
      });
      await cleanupPool.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => {});
      await cleanupPool.end();
    },
  };
}

/**
 * Creates a PayKit customer. In testing mode this also provisions a provider
 * customer (with a test clock for Stripe). No payment method attached.
 */
export async function createTestCustomer(input: {
  t: TestPayKit;
  customer: { id: string; email: string; name: string };
}): Promise<{ customerId: string; providerCustomerId: string }> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const uniqueId = `${input.customer.id}_${suffix}`;
  const uniqueEmail = buildUniqueTestEmail({
    email: input.customer.email,
    suffix,
  });

  await input.t.paykit.upsertCustomer({
    ...input.customer,
    id: uniqueId,
    email: uniqueEmail,
    upsertProviderCustomer: true,
  });

  const row = await input.t.database.query.customer.findFirst({
    where: eq(customer.id, uniqueId),
  });
  const providerCustomerId = row?.stripeCustomerId;

  if (!providerCustomerId) {
    throw new Error(
      `No ${input.t.harness.id} provider customer ID found for customer "${uniqueId}"`,
    );
  }

  // Route this customer's webhooks to this test's worker
  await registerCustomer(providerCustomerId, input.t.workerUrl);

  return { customerId: uniqueId, providerCustomerId };
}

/**
 * Creates a PayKit customer ready for direct subscription (no checkout).
 * For Stripe: attaches a test payment method.
 * For providers without direct subscription support, this is equivalent to createTestCustomer.
 */
export async function createTestCustomerWithPM(input: {
  t: TestPayKit;
  customer: { id: string; email: string; name: string };
}): Promise<{ customerId: string; providerCustomerId: string }> {
  const { customerId, providerCustomerId } = await createTestCustomer(input);

  await input.t.harness.setupCustomerForDirectSubscription(providerCustomerId);

  // For Stripe, sync the payment method into PayKit DB
  if (input.t.harness.id === "stripe") {
    const secretKey = env.E2E_STRIPE_SK!;
    const stripeClient = new Stripe(secretKey, { maxNetworkRetries: 3 });
    const pm = await stripeClient.paymentMethods.list({
      customer: providerCustomerId,
      type: "card",
      limit: 1,
    });
    const method = pm.data[0];
    if (method) {
      await syncPaymentMethodByProviderCustomer(input.t.ctx.database, {
        paymentMethod: {
          providerMethodId: method.id,
          type: method.type,
          last4: method.card?.last4,
          expiryMonth: method.card?.exp_month,
          expiryYear: method.card?.exp_year,
          isDefault: true,
        },
        providerCustomerId,
        providerId: input.t.ctx.provider.id,
      });
    }
  }

  return { customerId, providerCustomerId };
}

/**
 * Subscribe a customer to a plan, handling checkout flow if the provider requires it.
 * For providers with direct subscription (Stripe with PM): returns immediately.
 * For checkout flows: completes Stripe Checkout via Playwright and waits for webhook.
 */
export async function subscribeCustomer(input: {
  t: TestPayKit;
  customerId: string;
  planId: Parameters<TestPayKitInstance["subscribe"]>[0]["planId"];
}): Promise<void> {
  const beforeSubscribe = new Date();

  const result = await input.t.paykit.subscribe({
    customerId: input.customerId,
    planId: input.planId,
    successUrl: "https://example.com/success",
  });

  if (result.paymentUrl) {
    // Checkout-based flow — automate checkout completion
    await input.t.harness.completeCheckout(result.paymentUrl);

    // Wait for the subscription to become active via webhook
    await waitForWebhook({
      database: input.t.database,
      eventType: "subscription.updated",
      after: beforeSubscribe,
      timeout: 60_000,
    });
  }
}

export async function expectProduct(input: {
  database: PayKitDatabase;
  customerId: string;
  planId: string;
  expected: {
    status: "active" | "canceled" | "ended" | "scheduled";
    canceled?: boolean;
    hasPeriodEnd?: boolean;
  };
}): Promise<void> {
  const rows = await input.database
    .select({
      status: subscription.status,
      canceled: subscription.canceled,
      currentPeriodEndAt: subscription.currentPeriodEndAt,
    })
    .from(subscription)
    .innerJoin(product, eq(product.internalId, subscription.productInternalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.id, input.planId),
        eq(subscription.status, input.expected.status),
      ),
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);
  const row = rows[0];

  if (!row) {
    throw new Error(
      `Expected product "${input.planId}" with status "${input.expected.status}" for customer "${input.customerId}", but not found`,
    );
  }

  if (input.expected.canceled !== undefined && row.canceled !== input.expected.canceled) {
    throw new Error(
      `Expected product "${input.planId}" canceled=${String(input.expected.canceled)}, got ${String(row.canceled)}`,
    );
  }

  if (input.expected.hasPeriodEnd === true && row.currentPeriodEndAt == null) {
    throw new Error(`Expected product "${input.planId}" to have period end, but it's null`);
  }

  if (input.expected.hasPeriodEnd === false && row.currentPeriodEndAt != null) {
    throw new Error(
      `Expected product "${input.planId}" to have no period end, but got ${String(row.currentPeriodEndAt)}`,
    );
  }
}

export async function expectProductNotPresent(input: {
  database: PayKitDatabase;
  customerId: string;
  planId: string;
}): Promise<void> {
  const rows = await input.database
    .select({ status: subscription.status })
    .from(subscription)
    .innerJoin(product, eq(product.internalId, subscription.productInternalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.id, input.planId),
        sql`${subscription.status} NOT IN ('ended', 'canceled')`,
      ),
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);
  if (rows.length > 0) {
    const row = rows[0]!;
    throw new Error(
      `Expected product "${input.planId}" not present, but found with status "${row.status}"`,
    );
  }
}

export async function expectInvoiceCount(input: {
  database: PayKitDatabase;
  customerId: string;
  expectedAtLeast: number;
}): Promise<void> {
  const result = await input.database
    .select({ count: count() })
    .from(invoice)
    .where(eq(invoice.customerId, input.customerId));
  const actual = result[0]?.count ?? 0;
  if (actual < input.expectedAtLeast) {
    throw new Error(
      `Expected at least ${String(input.expectedAtLeast)} invoices, got ${String(actual)}`,
    );
  }
}

export async function expectSubscription(input: {
  database: PayKitDatabase;
  customerId: string;
  expected: { status?: string; cancelAtPeriodEnd?: boolean };
}): Promise<void> {
  const rows = await input.database
    .select({
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    })
    .from(subscription)
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        sql`${subscription.status} NOT IN ('ended', 'canceled')`,
      ),
    )
    .orderBy(desc(subscription.updatedAt))
    .limit(1);
  const row = rows[0];

  if (!row) {
    throw new Error(`No subscription found for customer "${input.customerId}"`);
  }

  if (input.expected.status !== undefined && row.status !== input.expected.status) {
    throw new Error(`Expected subscription status "${input.expected.status}", got "${row.status}"`);
  }

  if (
    input.expected.cancelAtPeriodEnd !== undefined &&
    row.cancelAtPeriodEnd !== input.expected.cancelAtPeriodEnd
  ) {
    throw new Error(
      `Expected cancel_at_period_end=${String(input.expected.cancelAtPeriodEnd)}, got ${String(row.cancelAtPeriodEnd)}`,
    );
  }
}

async function getPresentPlansInGroup(input: {
  database: PayKitDatabase;
  customerId: string;
  group: string;
}): Promise<
  Array<{
    canceled: boolean;
    currentPeriodEndAt: Date | null;
    planId: string;
    status: string;
  }>
> {
  return input.database
    .select({
      canceled: subscription.canceled,
      currentPeriodEndAt: subscription.currentPeriodEndAt,
      planId: product.id,
      status: subscription.status,
    })
    .from(subscription)
    .innerJoin(product, eq(product.internalId, subscription.productInternalId))
    .where(
      and(
        eq(subscription.customerId, input.customerId),
        eq(product.group, input.group),
        inArray(subscription.status, [...presentSubscriptionStatuses]),
        or(isNull(subscription.endedAt), sql`${subscription.endedAt} > now()`),
      ),
    )
    .orderBy(desc(subscription.createdAt));
}

export async function expectSingleActivePlanInGroup(input: {
  database: PayKitDatabase;
  customerId: string;
  group: string;
  planId: string;
}): Promise<void> {
  const rows = await getPresentPlansInGroup(input);
  const activeRows = rows.filter((row) =>
    activeSubscriptionStatuses.includes(row.status as (typeof activeSubscriptionStatuses)[number]),
  );

  if (activeRows.length !== 1) {
    throw new Error(
      `Expected exactly one active plan in group "${input.group}" for customer "${input.customerId}", got ${String(activeRows.length)}: ${JSON.stringify(activeRows)}`,
    );
  }

  const activeRow = activeRows[0]!;
  if (activeRow.planId !== input.planId) {
    throw new Error(
      `Expected active plan "${input.planId}" in group "${input.group}", got "${activeRow.planId}"`,
    );
  }
}

export async function expectSingleScheduledPlanInGroup(input: {
  database: PayKitDatabase;
  customerId: string;
  group: string;
  planId: string;
}): Promise<void> {
  const rows = await getPresentPlansInGroup(input);
  const scheduledRows = rows.filter((row) => row.status === "scheduled");

  if (scheduledRows.length !== 1) {
    throw new Error(
      `Expected exactly one scheduled plan in group "${input.group}" for customer "${input.customerId}", got ${String(scheduledRows.length)}: ${JSON.stringify(scheduledRows)}`,
    );
  }

  const scheduledRow = scheduledRows[0]!;
  if (scheduledRow.planId !== input.planId) {
    throw new Error(
      `Expected scheduled plan "${input.planId}" in group "${input.group}", got "${scheduledRow.planId}"`,
    );
  }
}

export async function expectNoScheduledPlanInGroup(input: {
  database: PayKitDatabase;
  customerId: string;
  group: string;
}): Promise<void> {
  const rows = await getPresentPlansInGroup(input);
  const scheduledRows = rows.filter((row) => row.status === "scheduled");

  if (scheduledRows.length > 0) {
    throw new Error(
      `Expected no scheduled plans in group "${input.group}" for customer "${input.customerId}", found: ${JSON.stringify(scheduledRows)}`,
    );
  }
}

export async function expectExactMeteredBalance(input: {
  customerId: string;
  featureId: Parameters<TestPayKitInstance["check"]>[0]["featureId"];
  limit: number;
  remaining: number;
  paykit: TestPayKitInstance;
}): Promise<void> {
  const result = await input.paykit.check({
    customerId: input.customerId,
    featureId: input.featureId,
  });

  if (!result.allowed) {
    throw new Error(
      `Expected feature "${input.featureId}" to be allowed for customer "${input.customerId}"`,
    );
  }

  if (!result.balance || result.balance.unlimited) {
    throw new Error(
      `Expected metered balance for feature "${input.featureId}", got ${JSON.stringify(result.balance)}`,
    );
  }

  if (result.balance.limit !== input.limit) {
    throw new Error(
      `Expected feature "${input.featureId}" limit ${String(input.limit)}, got ${String(result.balance.limit)}`,
    );
  }

  if (result.balance.remaining !== input.remaining) {
    throw new Error(
      `Expected feature "${input.featureId}" remaining ${String(input.remaining)}, got ${String(result.balance.remaining)}`,
    );
  }
}

async function startWebhookServer(
  paykit: Pick<TestPayKitInstance, "handler">,
  webhookRequests: CapturedWebhookRequest[],
): Promise<{ server: Server; workerUrl: string }> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString();

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${String(port)}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
    }

    webhookRequests.push({
      body,
      headers: Object.fromEntries(headers.entries()),
      path: url.pathname,
      receivedAt: new Date(),
    });

    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });

    try {
      const response = await paykit.handler(request);
      res.writeHead(response.status);
      res.end(await response.text());
    } catch (error) {
      res.writeHead(500);
      res.end(error instanceof Error ? error.message : "Internal error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (typeof address !== "object" || !address) {
    throw new Error("Failed to get webhook server address");
  }
  const workerUrl = `http://127.0.0.1:${String(address.port)}/`;
  return { server, workerUrl };
}

export async function advanceTestClock(input: {
  customerId: string;
  frozenTime: Date;
  t: TestPayKit;
}): Promise<void> {
  await input.t.paykit.advanceTestClock({
    customerId: input.customerId,
    frozenTime: input.frozenTime,
  });
}

export async function waitForWebhook(input: {
  after?: Date;
  database: PayKitDatabase;
  eventType: string;
  timeout?: number;
}): Promise<Record<string, unknown>> {
  const timeout = input.timeout ?? 30_000;
  const after = input.after ?? new Date(0);
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const row = await input.database.query.webhookEvent.findFirst({
      where: and(
        eq(webhookEvent.type, input.eventType),
        inArray(webhookEvent.status, ["processed", "failed"]),
        gt(webhookEvent.receivedAt, after),
      ),
      orderBy: (we, { desc: d }) => [d(we.receivedAt)],
    });

    if (row) {
      if (row.status === "failed") {
        throw new Error(`Webhook ${input.eventType} failed: ${String(row.error)}`);
      }
      return row as unknown as Record<string, unknown>;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for webhook: ${input.eventType}`);
}

export async function waitForForwardedWebhookRequest(input: {
  after?: Date;
  eventType?: string;
  providerEventId?: string;
  requests: CapturedWebhookRequest[];
  timeout?: number;
}): Promise<CapturedWebhookRequest> {
  const timeout = input.timeout ?? 15_000;
  const after = input.after ?? new Date(0);
  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (let i = input.requests.length - 1; i >= 0; i -= 1) {
      const request = input.requests[i]!;
      if (request.receivedAt <= after) {
        continue;
      }

      try {
        const payload = JSON.parse(request.body) as { id?: string; type?: string };
        const matchesProviderEventId =
          input.providerEventId !== undefined && payload.id === input.providerEventId;
        const matchesEventType = input.eventType !== undefined && payload.type === input.eventType;
        if (matchesProviderEventId || matchesEventType) {
          return request;
        }
      } catch {
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for forwarded webhook request: ${input.providerEventId ?? input.eventType ?? "unknown"}`,
  );
}

export async function replayWebhookRequest(input: {
  request: CapturedWebhookRequest;
}): Promise<void> {
  // Replay goes through the hub, which routes to the owning worker by customer ID.
  const response = await fetch(`http://127.0.0.1:${String(HUB_PORT)}${input.request.path}`, {
    body: input.request.body,
    headers: input.request.headers,
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Webhook replay failed (${String(response.status)}): ${text}`);
  }
}

export async function dumpStateOnFailure(database: PayKitDatabase, dbPath: string): Promise<void> {
  console.error("\n=== SMOKE TEST FAILURE — DB STATE DUMP ===");
  console.error(`Database path: ${dbPath}\n`);

  try {
    const customers = await database
      .select({ id: customer.id, email: customer.email, name: customer.name })
      .from(customer);
    console.error("\n--- paykit_customer ---");
    if (customers.length === 0) {
      console.error("  (empty)");
    } else {
      for (const row of customers) {
        console.error(JSON.stringify(row, null, 2));
      }
    }
  } catch {
    console.error("\n--- paykit_customer --- (query failed)");
  }

  try {
    const subscriptions = await database
      .select({
        id: subscription.id,
        customerId: subscription.customerId,
        status: subscription.status,
        canceled: subscription.canceled,
        startedAt: subscription.startedAt,
        endedAt: subscription.endedAt,
        currentPeriodStartAt: subscription.currentPeriodStartAt,
        currentPeriodEndAt: subscription.currentPeriodEndAt,
        scheduledProductId: subscription.scheduledProductId,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeSubscriptionScheduleId: subscription.stripeSubscriptionScheduleId,
      })
      .from(subscription)
      .orderBy(desc(subscription.updatedAt));
    console.error("\n--- paykit_subscription ---");
    if (subscriptions.length === 0) {
      console.error("  (empty)");
    } else {
      for (const row of subscriptions) {
        console.error(JSON.stringify(row, null, 2));
      }
    }
  } catch {
    console.error("\n--- paykit_subscription --- (query failed)");
  }

  try {
    const events = await database
      .select({
        type: webhookEvent.type,
        status: webhookEvent.status,
        error: webhookEvent.error,
        traceId: webhookEvent.traceId,
        receivedAt: webhookEvent.receivedAt,
      })
      .from(webhookEvent)
      .orderBy(desc(webhookEvent.receivedAt))
      .limit(10);
    console.error("\n--- paykit_webhook_event ---");
    if (events.length === 0) {
      console.error("  (empty)");
    } else {
      for (const row of events) {
        console.error(JSON.stringify(row, null, 2));
      }
    }
  } catch {
    console.error("\n--- paykit_webhook_event --- (query failed)");
  }

  console.error("\n=== END DUMP ===\n");
}
