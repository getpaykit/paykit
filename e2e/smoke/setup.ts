import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";

import { stripe } from "@paykitjs/stripe";
import { config } from "dotenv";
import { and, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { createPayKit, feature, plan } from "paykitjs";
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

config({ path: path.resolve(import.meta.dirname, "../../.env") });
config({ path: path.resolve(import.meta.dirname, "../../.env.local"), override: true });

const WEBHOOK_PORT = 4567;

const messagesFeature = feature({ id: "messages", type: "metered" });
const dashboardFeature = feature({ id: "dashboard", type: "boolean" });
const adminFeature = feature({ id: "admin", type: "boolean" });

export const freePlan = plan({
  default: true,
  group: "base",
  id: "free",
  name: "Free",
  includes: [messagesFeature({ limit: 100, reset: "month" })],
});

export const proPlan = plan({
  group: "base",
  id: "pro",
  name: "Pro",
  includes: [messagesFeature({ limit: 500, reset: "month" }), dashboardFeature()],
  price: { amount: 20, interval: "month" },
});

export const premiumPlan = plan({
  group: "base",
  id: "premium",
  name: "Premium",
  includes: [messagesFeature({ limit: 1_000, reset: "month" }), dashboardFeature(), adminFeature()],
  price: { amount: 50, interval: "month" },
});

export const ultraPlan = plan({
  group: "base",
  id: "ultra",
  name: "Ultra",
  includes: [
    messagesFeature({ limit: 10_000, reset: "month" }),
    dashboardFeature(),
    adminFeature(),
  ],
  price: { amount: 200, interval: "month" },
});

export const extraMessagesPlan = plan({
  group: "addons",
  id: "extra_messages",
  name: "Extra Messages",
  includes: [messagesFeature({ limit: 200, reset: "month" })],
  price: { amount: 5, interval: "month" },
});

type SmokePlans = {
  free: typeof freePlan;
  pro: typeof proPlan;
  premium: typeof premiumPlan;
  ultra: typeof ultraPlan;
  extra_messages: typeof extraMessagesPlan;
};

type SmokePayKit = ReturnType<
  typeof createPayKit<{
    database: Pool;
    plans: SmokePlans;
    provider: ReturnType<typeof stripe>;
    testing: { enabled: true };
  }>
>;

export interface TestPayKit {
  paykit: SmokePayKit;
  database: PayKitDatabase;
  ctx: PayKitContext;
  stripeClient: Stripe;
  dbPath: string;
  server: Server;
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

// createTestPayKit

export async function createTestPayKit(): Promise<TestPayKit> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set");
  }

  const stripeClient = new Stripe(secretKey);

  // 1. Create a fresh test database
  const dbName = `paykit_smoke_${String(Date.now())}`;
  const adminPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/postgres",
  });
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  await adminPool.end();

  const dbUrl = (process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/postgres").replace(
    /\/[^/]*$/,
    `/${dbName}`,
  );
  const pool = new Pool({ connectionString: dbUrl });

  // 2. Run migrations
  await migrateDatabase(pool);

  // 3. Create PayKit instance with real Stripe
  const stripeProvider = stripe({ secretKey, webhookSecret });
  const paykit = createPayKit({
    database: pool,
    plans: {
      free: freePlan,
      pro: proPlan,
      premium: premiumPlan,
      ultra: ultraPlan,
      extra_messages: extraMessagesPlan,
    },
    provider: stripeProvider,
    testing: { enabled: true },
  });

  const ctx = await paykit.$context;

  // Override createSubscription to use allow_incomplete. The default
  // payment_behavior: "default_incomplete" requires client-side payment
  // confirmation which isn't possible in automated tests.
  ctx.stripe.createSubscription = async (data) => {
    const sub = await stripeClient.subscriptions.create({
      customer: data.providerCustomerId,
      items: [{ price: data.providerPriceId }],
      payment_behavior: "allow_incomplete",
      expand: ["latest_invoice"],
    });

    const firstItem = sub.items.data[0];
    const periodStart = firstItem?.current_period_start ?? null;
    const periodEnd = firstItem?.current_period_end ?? null;
    const latestInvoice = sub.latest_invoice;
    const invoice =
      latestInvoice && typeof latestInvoice !== "string"
        ? {
            currency: latestInvoice.currency,
            hostedUrl: latestInvoice.hosted_invoice_url ?? null,
            periodEndAt: latestInvoice.period_end
              ? new Date(latestInvoice.period_end * 1000)
              : null,
            periodStartAt: latestInvoice.period_start
              ? new Date(latestInvoice.period_start * 1000)
              : null,
            providerInvoiceId: latestInvoice.id,
            status: latestInvoice.status,
            totalAmount: latestInvoice.total,
          }
        : null;

    return {
      invoice,
      paymentUrl: null,
      subscription: {
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at != null ? new Date(sub.canceled_at * 1000) : null,
        currentPeriodEndAt: periodEnd != null ? new Date(periodEnd * 1000) : null,
        currentPeriodStartAt: periodStart != null ? new Date(periodStart * 1000) : null,
        endedAt: sub.ended_at != null ? new Date(sub.ended_at * 1000) : null,
        providerSubscriptionId: sub.id,
        providerSubscriptionScheduleId: null,
        status: sub.status,
      },
    };
  };

  // 4. Start webhook server BEFORE syncing products — product sync
  // creates Stripe products which fires webhooks immediately
  const webhookRequests: CapturedWebhookRequest[] = [];
  const server = startWebhookServer(paykit, webhookRequests);

  // 5. Sync products to Stripe
  await syncProducts(ctx);

  return {
    paykit,
    database: ctx.database,
    ctx,
    stripeClient,
    dbPath: dbUrl,
    server,
    webhookRequests,
    cleanup: async () => {
      const customerRows = await ctx.database.query.customer.findMany();
      const testClockIds = new Set<string>();
      for (const row of customerRows) {
        const providerMap = (row.provider ?? {}) as Record<
          string,
          { id: string; testClockId?: string }
        >;
        const testClockId = providerMap.stripe?.testClockId;
        if (testClockId) {
          testClockIds.add(testClockId);
        }
      }

      for (const testClockId of testClockIds) {
        await stripeClient.testHelpers.testClocks.del(testClockId).catch(() => {});
      }

      // Wait for cleanup webhooks to arrive and be processed
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      server.close();
      await pool.end();
      // Drop the test database
      const cleanupPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/postgres",
      });
      await cleanupPool.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => {});
      await cleanupPool.end();
    },
  };
}

/**
 * Creates a PayKit customer. In testing mode this also provisions a Stripe
 * customer with a dedicated test clock. No payment method attached — first
 * paid subscribe will go through checkout.
 */
export async function createTestCustomer(input: {
  t: TestPayKit;
  customer: { id: string; email: string; name: string };
}): Promise<{ customerId: string; providerCustomerId: string }> {
  await input.t.paykit.upsertCustomer(input.customer);

  // Now the provider customer ID is stored in the customer's provider JSONB column
  const row = await input.t.database.query.customer.findFirst({
    where: eq(customer.id, input.customer.id),
  });
  const providerMap = (row?.provider ?? {}) as Record<string, { id: string }>;
  const providerCustomerId = providerMap.stripe?.id;

  if (!providerCustomerId) {
    throw new Error(`No Stripe provider customer ID found for customer "${input.customer.id}"`);
  }

  return { customerId: input.customer.id, providerCustomerId };
}

/**
 * Creates a PayKit customer with a pre-attached payment method.
 * Subscribe calls will go through the direct path (no checkout).
 */
export async function createTestCustomerWithPM(input: {
  t: TestPayKit;
  customer: { id: string; email: string; name: string };
}): Promise<{ customerId: string; providerCustomerId: string }> {
  const { customerId, providerCustomerId } = await createTestCustomer(input);

  // Attach test payment method to Stripe customer
  const pm = await input.t.stripeClient.paymentMethods.attach("pm_card_visa", {
    customer: providerCustomerId,
  });
  await input.t.stripeClient.customers.update(providerCustomerId, {
    invoice_settings: { default_payment_method: pm.id },
  });

  // Sync payment method into PayKit DB
  await syncPaymentMethodByProviderCustomer(input.t.ctx.database, {
    paymentMethod: {
      providerMethodId: pm.id,
      type: pm.type,
      last4: pm.card?.last4,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
      isDefault: true,
    },
    providerCustomerId,
    providerId: input.t.ctx.provider.id,
  });

  return { customerId, providerCustomerId };
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
  featureId: Parameters<SmokePayKit["check"]>[0]["featureId"];
  limit: number;
  remaining: number;
  paykit: SmokePayKit;
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

function startWebhookServer(
  paykit: Pick<SmokePayKit, "handler">,
  webhookRequests: CapturedWebhookRequest[],
): Server {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString();

    const url = new URL(req.url ?? "/", `http://localhost:${String(WEBHOOK_PORT)}`);
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

  server.listen(WEBHOOK_PORT);
  return server;
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
  const response = await fetch(`http://localhost:${String(WEBHOOK_PORT)}${input.request.path}`, {
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
        providerData: subscription.providerData,
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
