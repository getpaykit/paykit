# PayKit — SDK API Design

> TypeScript-first payments orchestration. Provider-agnostic.
> Your database is the source of truth.

---

## Initialization

### Server

```typescript
import { createPayKit } from "paykit"
import { stripe } from "paykit/providers/stripe"
import { drizzleAdapter } from "paykit/adapters/drizzle"

export const paykit = createPayKit({
  // Database adapter — required
  database: drizzleAdapter(db),

  // Provider adapters — at least one required
  providers: [
    stripe({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
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
  ],
});
```

### Client

```typescript
import { createPayKitClient } from "paykit/client";

const paykit = createPayKitClient({
  baseURL: "http://localhost:3000/api/paykit",
});
```

### Framework Handlers

```typescript
// Next.js — app/api/paykit/[...path]/route.ts
import { paykit } from "@/lib/paykit";

export const { GET, POST } = paykit.handler;

// Hono
app.all("/api/paykit/*", (c) => paykit.handler(c.req.raw));

// Express
app.all("/api/paykit/*", paykit.toNodeHandler());
```

---

## Customers

Customers are created automatically on first interaction when using
`customer.resolve`, or manually:

```typescript
// Manual creation
await paykit.api.createCustomer({
  externalId: "user_123", // your internal user ID
  name: "Jane Doe",
  email: "jane@example.com",
  metadata: { company: "Acme" },
});

// Lookup
const customer = await paykit.api.getCustomer({ id: "cust_abc" });
const customer = await paykit.api.getCustomerByExternalId({ externalId: "user_123" });
```

---

## Checkout

One-time payment via provider-hosted checkout. Pass the amount and
description inline — no pre-created products or prices needed.

### Server-side

```typescript
const checkout = await paykit.api.createCheckout({
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
const { data, error } = await paykit.checkout.create({
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

Subscriptions are created through each provider's native billing engine
(Stripe Billing, PayPal subscriptions, etc.) via a unified API. PayKit
delegates lifecycle management to the provider and syncs state back to
your database through webhooks.

### Create a Subscription

```typescript
const subscription = await paykit.api.createSubscription({
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
const sub = await paykit.api.getSubscription({ id: "sub_abc" });

const subs = await paykit.api.listSubscriptions({
  customerId: "cust_abc",
  status: "active", // "active" | "trialing" | "past_due" | "canceled" | "paused"
});
```

### Cancel

```typescript
await paykit.api.cancelSubscription({
  id: "sub_abc",
  mode: "at_period_end", // "at_period_end" | "immediately"
});
```

### Resume a Canceled Subscription

```typescript
await paykit.api.resumeSubscription({ id: "sub_abc" });
```

### Pause / Unpause

```typescript
await paykit.api.pauseSubscription({ id: "sub_abc" });
await paykit.api.resumeSubscription({ id: "sub_abc" });
```

### Subscription States

These states are normalized across providers — regardless of whether the
subscription lives on Stripe, PayPal, or another provider, PayKit maps
the provider's status to one of these:

- **trialing** — trial period active, no charges yet
- **active** — subscription is current, renewing automatically
- **past_due** — charge failed, provider is retrying per its own policy
- **paused** — manually paused, no charges
- **canceled** — subscription ended, no further charges

---

## Payment Methods

### Attach a Payment Method

```typescript
// Returns a provider-hosted URL for the customer to enter their card
const result = await paykit.api.attachPaymentMethod({
  customerId: "cust_abc",
  returnURL: "https://myapp.com/settings/billing",
});
// result.url -> redirect user
```

### List / Manage

```typescript
const methods = await paykit.api.listPaymentMethods({ customerId: "cust_abc" });

await paykit.api.setDefaultPaymentMethod({
  customerId: "cust_abc",
  paymentMethodId: "pm_xyz",
});

await paykit.api.detachPaymentMethod({ id: "pm_xyz" });
```

---

## Invoices

Invoices are synced from the provider's billing system via webhooks. You
can also create one-off invoices for custom charges.

### List Invoices

```typescript
const invoices = await paykit.api.listInvoices({
  customerId: "cust_abc",
  status: "paid", // "draft" | "open" | "paid" | "void" | "uncollectible"
  limit: 10,
});
```

### Get Invoice

```typescript
const invoice = await paykit.api.getInvoice({ id: "inv_abc" });

// invoice.pdfURL   -> download link
// invoice.lines    -> line items
// invoice.total    -> amount in cents
// invoice.status   -> current status
```

### Create a One-Off Invoice

```typescript
const invoice = await paykit.api.createInvoice({
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

## Events

All events originate from provider webhooks. PayKit verifies the signature,
normalizes the event into a consistent shape, syncs state to your database,
and then calls your event handlers.

For example, Stripe's `invoice.payment_failed` and PayPal's
`BILLING.SUBSCRIPTION.PAYMENT.FAILED` both become `invoice.payment_failed`
with the same payload shape.

```typescript
on: {
  // Payment method updates
  "payment_method.attached": ({ paymentMethod, customer }) => {},
  "payment_method.detached": ({ paymentMethod, customer }) => {},
  "payment_method.expiring": ({ paymentMethod, customer }) => {},

  // Charge results
  "charge.succeeded":        ({ charge, customer }) => {},
  "charge.failed":           ({ charge, customer, error }) => {},
  "charge.disputed":         ({ charge, customer, dispute }) => {},
  "charge.refunded":         ({ charge, customer, refund }) => {},

  // Subscription lifecycle (from provider webhooks, normalized)
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
  const paykit = usePayKit();

  const handleCheckout = async () => {
    const { data, error } = await paykit.checkout.create({
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

All methods are available on `paykit.api.*` for server-side use:

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

---

## Provider Adapter Contract

Providers handle payments, subscriptions, and payment methods through
their native APIs. PayKit delegates to them and normalizes the results.

Every provider adapter implements this interface:

```typescript
interface PayKitProvider {
  id: string; // "stripe" | "paypal" | ...

  // --- Payment methods ---

  // Save a payment method for future charges (provider-hosted UI)
  attachPaymentMethod(data: {
    customerId: string;
    returnURL: string;
  }): Promise<{ url: string }>;

  // Remove a saved payment method
  detachPaymentMethod(data: {
    paymentMethodId: string;
  }): Promise<void>;

  // --- Charges ---

  // Charge a saved payment method (one-off)
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

  // One-time payment via provider-hosted checkout
  checkout(data: {
    amount: number;
    description: string;
    successURL: string;
    cancelURL: string;
    attach?: boolean; // also save the payment method
    metadata?: Record<string, string>;
  }): Promise<{ url: string }>;

  // --- Subscriptions (provider-native) ---

  // Create a subscription on the provider
  createSubscription(data: {
    customerId: string;
    paymentMethodId: string;
    amount: number;
    interval: "week" | "month" | "year";
    description: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }): Promise<ProviderSubscription>;

  // Cancel a subscription on the provider
  cancelSubscription(data: {
    subscriptionId: string;
    mode: "at_period_end" | "immediately";
  }): Promise<void>;

  // Pause a subscription on the provider
  pauseSubscription(data: {
    subscriptionId: string;
  }): Promise<void>;

  // Resume a subscription on the provider
  resumeSubscription(data: {
    subscriptionId: string;
  }): Promise<void>;

  // --- Webhooks ---

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

1. **Your DB is the source of truth.** Subscriptions, invoices, and
   customer data are synced to your database via webhooks. Your business
   logic reads from your DB, not the provider API.

2. **No provider leakage.** You never see `stripeSubscriptionId` in
   business code. Provider IDs are stored internally and resolved by
   PayKit.

3. **Orchestrate, don't reimplement.** Providers have battle-tested
   subscription engines, checkout flows, and retry logic. PayKit uses
   them — it doesn't rebuild them. The value is the unified layer on top.

4. **No product catalog.** PayKit is a payments layer, not an ecommerce
   platform. Pass amounts and descriptions inline. Your app owns its
   own product catalog — PayKit doesn't need to know about it.

5. **Type safety everywhere.** All inputs, outputs, events, and plugin
   extensions are fully typed. Plugin endpoints merge into `paykit.api.*`
   types automatically.

6. **Framework-agnostic.** Core runs anywhere. Framework bindings
   (Next.js, Hono, Express) are thin adapters over the same handler.
