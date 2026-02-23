# PayKit — SDK API Design

> TypeScript-first payments orchestration. Provider-agnostic.
> Your database is the source of truth.

---

## Initialization

### Server

```typescript
import { paykit } from "paykit";
import { stripe } from "@paykit/stripe";
import { prisma } from "@paykit/prisma";

export const pk = paykit({
  // Database adapter — required
  database: prisma(prismaClient),

  // Provider adapters — at least one required
  providers: [
    stripe({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  ],

  // Customer identity resolution
  customer: {
    resolve: async (ctx) => {
      // Return your internal user/customer ID
      const session = await auth.api.getSession({ headers: ctx.headers });
      return { id: session.user.id };
    },
  },

  // Webhook event handlers (optional)
  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!");
    },
    "payment.succeeded": async ({ payment }) => {
      console.log("Payment received:", payment.id);
    },
    "invoice.created": async ({ invoice }) => {
      console.log("Invoice:", invoice.id);
    },
  },

  // Plugins (optional)
  plugins: [
    walletPlugin(),
    usageBillingPlugin(),
  ],
});
```

### Client

```typescript
import { createPayKitClient } from "paykit/client";

const pk = createPayKitClient({
  baseURL: "http://localhost:3000/api/paykit",
});
```

### Framework Handlers

```typescript
// Next.js — app/api/paykit/[...path]/route.ts
import { pk } from "@/lib/paykit";

export const { GET, POST } = pk.handler;

// Hono
app.all("/api/paykit/*", (c) => pk.handler(c.req.raw));

// Express
app.all("/api/paykit/*", pk.toNodeHandler());
```

---

## Customers

Customers are created automatically on first interaction when using
`customer.resolve`, or manually:

```typescript
// Manual creation
await pk.api.createCustomer({
  externalId: "user_123", // your internal user ID
  name: "Jane Doe",
  email: "jane@example.com",
  metadata: { company: "Acme" },
});

// Lookup
const customer = await pk.api.getCustomer({ id: "cust_abc" });
const customer = await pk.api.getCustomerByExternalId({ externalId: "user_123" });
```

---

## Checkout

One-time payment via provider-hosted checkout. Pass the amount and
description inline — no pre-created products or prices needed.

### Server-side

```typescript
const checkout = await pk.api.createCheckout({
  customerId: "cust_abc",
  amount: 9900, // $99.00 in cents
  description: "Lifetime License",
  successURL: "https://myapp.com/success",
  cancelURL: "https://myapp.com/cancel",
  attachMethod: true, // also save the payment method for future charges
  metadata: { referral: "campaign_42" },
});

// checkout.url -> redirect the user here
```

### Client-side

```typescript
const { data, error } = await pk.checkout.create({
  amount: 9900,
  description: "Lifetime License",
  successURL: "/success",
  cancelURL: "/cancel",
  attachMethod: true,
});

if (data) {
  window.location.href = data.url;
}
```

---

## Subscriptions

Subscriptions store their amount and interval inline. Your app decides
what to charge — PayKit doesn't need a product catalog.

### Create a Subscription

```typescript
const subscription = await pk.api.createSubscription({
  customerId: "cust_abc",
  amount: 2900, // $29.00 in cents
  interval: "month", // "month" | "year" | "week"
  description: "Pro Plan",
  paymentMethodId: "pm_xyz",
  trialDays: 14,
  metadata: { source: "onboarding" },
});
```

### Read Subscriptions

```typescript
const sub = await pk.api.getSubscription({ id: "sub_abc" });

const subs = await pk.api.listSubscriptions({
  customerId: "cust_abc",
  status: "active", // "active" | "trialing" | "past_due" | "canceled" | "paused"
});
```

### Cancel

```typescript
await pk.api.cancelSubscription({
  id: "sub_abc",
  mode: "at_period_end", // "at_period_end" | "immediately"
});
```

### Resume a Canceled Subscription

```typescript
await pk.api.resumeSubscription({ id: "sub_abc" });
```

### Pause / Unpause

```typescript
await pk.api.pauseSubscription({ id: "sub_abc" });
await pk.api.resumeSubscription({ id: "sub_abc" });
```

---

## Payment Methods

### Attach a Payment Method

```typescript
// Returns a provider-hosted URL for the customer to enter their card
const result = await pk.api.attachPaymentMethod({
  customerId: "cust_abc",
  returnURL: "https://myapp.com/settings/billing",
});
// result.url -> redirect user
```

### List / Manage

```typescript
const methods = await pk.api.listPaymentMethods({ customerId: "cust_abc" });

await pk.api.setDefaultPaymentMethod({
  customerId: "cust_abc",
  paymentMethodId: "pm_xyz",
});

await pk.api.detachPaymentMethod({ id: "pm_xyz" });
```

---

## Invoices

### List Invoices

```typescript
const invoices = await pk.api.listInvoices({
  customerId: "cust_abc",
  status: "paid", // "draft" | "open" | "paid" | "void" | "uncollectible"
  limit: 10,
});
```

### Get Invoice

```typescript
const invoice = await pk.api.getInvoice({ id: "inv_abc" });

// invoice.pdfURL   -> download link
// invoice.lines    -> line items
// invoice.total    -> amount in cents
// invoice.status   -> current status
```

### Create a One-Off Invoice

```typescript
const invoice = await pk.api.createInvoice({
  customerId: "cust_abc",
  lines: [
    { description: "Consulting — Jan 2026", amount: 50000, quantity: 1 },
    { description: "Setup fee", amount: 10000, quantity: 1 },
  ],
  dueDate: "2026-02-28",
  autoCollect: true, // charge the default payment method
});
```

---

## Usage Tracking

For usage-based billing (API calls, tokens, storage, etc.).

### Report Usage

```typescript
await pk.api.reportUsage({
  subscriptionId: "sub_abc",
  metric: "api_calls",
  value: 1500,
  timestamp: new Date(),
});
```

### Query Usage

```typescript
const usage = await pk.api.getUsage({
  subscriptionId: "sub_abc",
  metric: "api_calls",
  period: "current", // "current" | "previous" | { from, to }
});

// usage.total    -> 15000
// usage.limit    -> 50000 (if capped)
// usage.records  -> [{ timestamp, value }]
```

---

## Events

PayKit emits two kinds of events: **provider events** (from webhooks)
and **lifecycle events** (from PayKit's own billing engine). Both are
handled in the same `on` config.

```typescript
on: {
  // --- Provider events (from webhooks) ---

  // Payment method updates
  "payment_method.attached": ({ paymentMethod, customer }) => {},
  "payment_method.detached": ({ paymentMethod, customer }) => {},
  "payment_method.expiring": ({ paymentMethod, customer }) => {},

  // Charge results (from checkout or billing engine charges)
  "charge.succeeded":        ({ charge, customer }) => {},
  "charge.failed":           ({ charge, customer, error }) => {},
  "charge.disputed":         ({ charge, customer, dispute }) => {},
  "charge.refunded":         ({ charge, customer, refund }) => {},

  // --- Lifecycle events (from PayKit's billing engine) ---

  // Subscription state machine transitions
  "subscription.created":    ({ subscription, customer }) => {},
  "subscription.activated":  ({ subscription, customer }) => {},
  "subscription.renewed":    ({ subscription, customer, invoice }) => {},
  "subscription.past_due":   ({ subscription, customer, invoice }) => {},
  "subscription.paused":     ({ subscription, customer }) => {},
  "subscription.resumed":    ({ subscription, customer }) => {},
  "subscription.canceled":   ({ subscription, customer }) => {},

  // Invoice lifecycle
  "invoice.created":         ({ invoice, customer }) => {},
  "invoice.paid":            ({ invoice, customer }) => {},
  "invoice.payment_failed":  ({ invoice, customer, error }) => {},

  // Catch-all
  "*":                       ({ event }) => {},
}
```

---

## Billing Engine

PayKit runs its own billing engine to manage subscription renewals,
usage calculation, and failed payment retries. Since providers don't
manage subscriptions, this is what drives the billing cycle.

### How It Works

On each billing cycle tick, the engine:

1. Finds subscriptions due for renewal
2. Calculates the amount (fixed price + usage-based charges)
3. Creates an invoice in your database
4. Charges the customer's default payment method via the provider
5. On success: marks invoice paid, renews the subscription period
6. On failure: marks invoice failed, applies retry/dunning policy

### Configuration

```typescript
export const pk = paykit({
  // ...providers, database, etc.

  billing: {
    // How often the engine checks for due subscriptions
    // In production, this runs as a cron job or background worker
    interval: "1h", // default: "1h"

    // What happens when a charge fails
    dunning: {
      retries: 3,              // number of retry attempts
      retryInterval: "3d",     // wait between retries
      gracePeriod: "7d",       // how long before canceling
      onRetry: async ({ subscription, attempt }) => {
        await sendEmail(subscription.customer.email,
          `Payment failed (attempt ${attempt}/3)`);
      },
      onGracePeriodExpired: async ({ subscription }) => {
        // subscription is automatically canceled after this
        await sendEmail(subscription.customer.email,
          "Your subscription has been canceled");
      },
    },
  },
});
```

### Running the Engine

```typescript
// Development: run inline (blocks the process)
await pk.billing.start();

// Production: trigger from an external cron / task scheduler
// e.g., a Next.js API route called by Vercel Cron
export async function GET() {
  await pk.billing.tick(); // process one cycle
  return Response.json({ ok: true });
}
```

### Subscription States

- **trialing** — trial period active, no charges yet. Transitions to
  `active` when trial ends (and first charge succeeds).
- **active** — subscription is current. Renewed automatically each
  billing cycle. Transitions to `past_due` if a charge fails.
- **past_due** — charge failed, retrying per dunning policy. Transitions
  back to `active` if a retry succeeds, or to `canceled` if retries
  are exhausted and the grace period expires.
- **paused** — manually paused by the user or your app. No charges.
  Transitions back to `active` on resume.
- **canceled** — subscription ended. No further charges. Can be
  terminal or allow reactivation depending on your config.

---

## Client SDK (React)

```tsx
import { PayKitProvider, useCustomer, useSubscription } from "paykit/react";

// Wrap your app
function App() {
  return (
    <PayKitProvider baseURL="/api/paykit">
      <BillingPage />
    </PayKitProvider>
  );
}

function BillingPage() {
  const { customer, isLoading } = useCustomer();
  const { subscription } = useSubscription();

  if (isLoading) return <Spinner />;

  return (
    <div>
      <p>Plan: {subscription?.description ?? "Free"}</p>
      <p>Status: {subscription?.status}</p>
      <p>Next invoice: {subscription?.currentPeriodEnd}</p>

      <BuyButton />
      <InvoiceHistory />
    </div>
  );
}

function BuyButton() {
  const pk = usePayKit();

  const handleCheckout = async () => {
    const { data, error } = await pk.checkout.create({
      amount: 9900,
      description: "Lifetime License",
      successURL: "/billing?purchased=true",
    });
    if (data) window.location.href = data.url;
  };

  return <button onClick={handleCheckout}>Buy Now</button>;
}

function InvoiceHistory() {
  const { invoices } = useInvoices();

  return (
    <ul>
      {invoices.map((inv) => (
        <li key={inv.id}>
          ${inv.total / 100} — {inv.status}
          {inv.pdfURL && <a href={inv.pdfURL}>PDF</a>}
        </li>
      ))}
    </ul>
  );
}
```

---

## Server-Side API Reference (Summary)

All methods are available on `pk.api.*` for server-side use:

| Category           | Method                       | Description                        |
| ------------------ | ---------------------------- | ---------------------------------- |
| **Customers**      | `createCustomer`             | Create a customer                  |
|                    | `getCustomer`                | Get customer by ID                 |
|                    | `getCustomerByExternalId`    | Lookup by your internal ID         |
|                    | `updateCustomer`             | Update customer data               |
| **Checkout**       | `createCheckout`             | One-time payment (+ optional save) |
| **Subscriptions**  | `createSubscription`         | Start a subscription               |
|                    | `getSubscription`            | Get subscription by ID             |
|                    | `listSubscriptions`          | List (filter by customer)          |
|                    | `cancelSubscription`         | Cancel a subscription              |
|                    | `pauseSubscription`          | Pause a subscription               |
|                    | `resumeSubscription`         | Resume paused/canceled sub         |
| **Payment Methods**| `attachPaymentMethod`        | Save a payment method              |
|                    | `listPaymentMethods`         | List customer payment methods      |
|                    | `setDefaultPaymentMethod`    | Set the default method             |
|                    | `detachPaymentMethod`        | Remove a payment method            |
| **Invoices**       | `createInvoice`              | Create a one-off invoice           |
|                    | `getInvoice`                 | Get invoice by ID                  |
|                    | `listInvoices`               | List (filter by customer)          |
| **Usage**          | `reportUsage`                | Report usage for a metric          |
|                    | `getUsage`                   | Query usage data                   |

---

## Provider Adapter Contract

Providers are payment rails — they charge, refund, and manage payment
methods. Products, subscriptions, invoices, and usage all live in PayKit
core and your database. Nothing is synced to the provider.

Every provider adapter implements this interface:

```typescript
interface PayKitProvider {
  id: string; // "stripe" | "paypal" | ...

  // Save a payment method for future charges (provider-hosted UI)
  attach(data: {
    customerId: string;
    returnURL: string;
  }): Promise<{ url: string }>;

  // Remove a saved payment method
  detach(data: {
    paymentMethodId: string;
  }): Promise<void>;

  // Charge a saved payment method
  charge(data: {
    paymentMethodId: string;
    amount: number;
    description: string;
    metadata?: Record<string, string>;
  }): Promise<ProviderCharge>;

  // Refund a charge
  refund(data: {
    chargeId: string;
    amount?: number; // partial refund, or omit for full
  }): Promise<ProviderRefund>;

  // One-time payment via provider-hosted checkout (no saved method needed)
  checkout(data: {
    amount: number;
    description: string;
    successURL: string;
    cancelURL: string;
    attach?: boolean; // also save the payment method for future use
    metadata?: Record<string, string>;
  }): Promise<{ url: string }>;

  // Verify signature + normalize raw provider event into a PayKit event
  handleWebhook(data: {
    body: string;
    headers: Record<string, string>;
  }): PayKitEvent;
}
```

---

## Plugin System

Plugins extend PayKit with new capabilities:

```typescript
import type { PayKitPlugin } from "paykit";

export const walletPlugin = (): PayKitPlugin => ({
  id: "wallet",

  // Extend the database schema
  schema: {
    wallet: {
      fields: {
        customerId: { type: "string", references: { table: "customer", field: "id" } },
        balance: { type: "number", default: 0 },
        currency: { type: "string", default: "usd" },
      },
    },
    walletTransaction: {
      fields: {
        walletId: { type: "string", references: { table: "wallet", field: "id" } },
        amount: { type: "number" },
        type: { type: "string" }, // "credit" | "debit"
        description: { type: "string" },
      },
    },
  },

  // Add new API endpoints
  endpoints: {
    getBalance: {
      path: "/wallet/balance",
      method: "GET",
      handler: async (ctx) => {
        const wallet = await ctx.db.wallet.findByCustomerId(ctx.customerId);
        return { balance: wallet.balance, currency: wallet.currency };
      },
    },
    topUp: {
      path: "/wallet/top-up",
      method: "POST",
      body: z.object({ amount: z.number().positive() }),
      handler: async (ctx) => {
        // charge via provider, then credit wallet
      },
    },
  },

  // Hook into lifecycle events
  hooks: {
    "payment.succeeded": async ({ payment, ctx }) => {
      // e.g., auto-credit wallet on successful payment
    },
  },
});
```

---

## Design Principles (reflected in the API)

1. **Your DB is the source of truth.** Products, subscriptions, invoices,
   and usage live entirely in your database. Providers are only used as
   payment rails (charge, refund, attach/detach methods). Webhook handlers
   update your database, then call your event handlers.

2. **No provider leakage.** You never see `stripeSubscriptionId` in
   business code. Provider IDs are stored internally and resolved by
   PayKit.

3. **No product catalog.** PayKit is a payments layer, not an ecommerce
   platform. Pass amounts and descriptions inline. Your app owns its
   own product catalog — PayKit doesn't need to know about it.

4. **Type safety everywhere.** All inputs, outputs, events, and plugin
   extensions are fully typed. Plugin endpoints merge into `pk.api.*`
   types automatically.

5. **Framework-agnostic.** Core runs anywhere. Framework bindings
   (Next.js, Hono, Express) are thin adapters over the same handler.
