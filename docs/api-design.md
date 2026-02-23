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

## Products & Prices

Define products and prices in your database via the SDK.

### Create a Product

```typescript
await pk.api.createProduct({
  name: "Pro Plan",
  description: "Everything you need",
  metadata: { tier: "pro" },
});
```

### Create Prices for a Product

```typescript
// Recurring price
await pk.api.createPrice({
  productId: "prod_abc",
  amount: 2900, // $29.00 in cents
  currency: "usd",
  interval: "month",
});

// One-time price
await pk.api.createPrice({
  productId: "prod_abc",
  amount: 9900,
  currency: "usd",
  type: "one_time",
});

// Usage-based price
await pk.api.createPrice({
  productId: "prod_abc",
  currency: "usd",
  type: "usage",
  unitAmount: 10, // $0.10 per unit
  usageMetric: "api_calls",
});
```

### List Products

```typescript
const products = await pk.api.listProducts();
const product = await pk.api.getProduct({ id: "prod_abc" });
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

Redirect the user to a provider-hosted checkout page.

### Server-side

```typescript
const checkout = await pk.api.createCheckout({
  customerId: "cust_abc",
  priceId: "price_xyz",
  successURL: "https://myapp.com/success",
  cancelURL: "https://myapp.com/cancel",
  quantity: 1,
  metadata: { referral: "campaign_42" },
});

// checkout.url -> redirect the user here
```

### Client-side

```typescript
const { data, error } = await pk.checkout.create({
  priceId: "price_xyz",
  successURL: "/success",
  cancelURL: "/cancel",
});

if (data) {
  window.location.href = data.url;
}
```

---

## Subscriptions

### Create a Subscription

```typescript
const subscription = await pk.api.createSubscription({
  customerId: "cust_abc",
  priceId: "price_xyz",
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

### Change Plan (Up/Downgrade)

```typescript
await pk.api.updateSubscription({
  id: "sub_abc",
  priceId: "price_new",
  proration: "always", // "always" | "never" | "on_upgrade"
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
// Returns a setup URL for the customer to enter their card
const setup = await pk.api.createSetupSession({
  customerId: "cust_abc",
  returnURL: "https://myapp.com/settings/billing",
});
// setup.url -> redirect user
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

## Webhooks

Webhooks are handled automatically. The provider adapter verifies
signatures, normalizes events, updates your database, then calls your
handlers.

### Normalized Events

All events follow a consistent shape regardless of provider:

```typescript
on: {
  // Subscription lifecycle
  "subscription.created":    ({ subscription, customer }) => {},
  "subscription.activated":  ({ subscription, customer }) => {},
  "subscription.updated":    ({ subscription, customer, changes }) => {},
  "subscription.paused":     ({ subscription, customer }) => {},
  "subscription.resumed":    ({ subscription, customer }) => {},
  "subscription.canceled":   ({ subscription, customer }) => {},

  // Payments
  "payment.succeeded":       ({ payment, customer }) => {},
  "payment.failed":          ({ payment, customer, error }) => {},
  "payment.refunded":        ({ payment, customer, refund }) => {},

  // Invoices
  "invoice.created":         ({ invoice, customer }) => {},
  "invoice.paid":            ({ invoice, customer }) => {},
  "invoice.payment_failed":  ({ invoice, customer }) => {},

  // Payment methods
  "payment_method.attached": ({ paymentMethod, customer }) => {},
  "payment_method.detached": ({ paymentMethod, customer }) => {},

  // Catch-all
  "*":                       ({ event, provider }) => {},
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
      <p>Plan: {subscription?.product.name ?? "Free"}</p>
      <p>Status: {subscription?.status}</p>
      <p>Next invoice: {subscription?.currentPeriodEnd}</p>

      <UpgradeButton />
      <InvoiceHistory />
    </div>
  );
}

function UpgradeButton() {
  const pk = usePayKit();

  const handleUpgrade = async () => {
    const { data, error } = await pk.checkout.create({
      priceId: "price_pro_monthly",
      successURL: "/billing?upgraded=true",
    });
    if (data) window.location.href = data.url;
  };

  return <button onClick={handleUpgrade}>Upgrade to Pro</button>;
}

function InvoiceHistory() {
  const { invoices } = useInvoices();

  return (
    <ul>
      {invoices.map((inv) => (
        <li key={inv.id}>
          {inv.total / 100} {inv.currency.toUpperCase()} — {inv.status}
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

| Category           | Method                       | Description                     |
| ------------------ | ---------------------------- | ------------------------------- |
| **Products**       | `createProduct`              | Create a product                |
|                    | `updateProduct`              | Update a product                |
|                    | `getProduct`                 | Get product by ID               |
|                    | `listProducts`               | List all products               |
| **Prices**         | `createPrice`                | Create a price for a product    |
|                    | `updatePrice`                | Update a price                  |
|                    | `listPrices`                 | List prices (filter by product) |
| **Customers**      | `createCustomer`             | Create a customer               |
|                    | `getCustomer`                | Get customer by ID              |
|                    | `getCustomerByExternalId`    | Lookup by your internal ID      |
|                    | `updateCustomer`             | Update customer data            |
| **Checkout**       | `createCheckout`             | Create a checkout session       |
| **Subscriptions**  | `createSubscription`         | Start a subscription            |
|                    | `getSubscription`            | Get subscription by ID          |
|                    | `listSubscriptions`          | List (filter by customer)       |
|                    | `updateSubscription`         | Change plan / proration         |
|                    | `cancelSubscription`         | Cancel a subscription           |
|                    | `pauseSubscription`          | Pause a subscription            |
|                    | `resumeSubscription`         | Resume paused/canceled sub      |
| **Payment Methods**| `createSetupSession`         | Setup session to add a card     |
|                    | `listPaymentMethods`         | List customer payment methods   |
|                    | `setDefaultPaymentMethod`    | Set the default method          |
|                    | `detachPaymentMethod`        | Remove a payment method         |
| **Invoices**       | `createInvoice`              | Create a one-off invoice        |
|                    | `getInvoice`                 | Get invoice by ID               |
|                    | `listInvoices`               | List (filter by customer)       |
| **Usage**          | `reportUsage`                | Report usage for a metric       |
|                    | `getUsage`                   | Query usage data                |

---

## Provider Adapter Contract

Every provider adapter implements this interface:

```typescript
interface PayKitProvider {
  id: string; // "stripe" | "paypal" | ...

  // Products & Prices
  createProduct(data): Promise<ProviderProduct>;
  createPrice(data): Promise<ProviderPrice>;

  // Checkout
  createCheckoutSession(data): Promise<{ url: string; sessionId: string }>;
  createSetupSession(data): Promise<{ url: string; sessionId: string }>;

  // Subscriptions
  createSubscription(data): Promise<ProviderSubscription>;
  updateSubscription(id, data): Promise<ProviderSubscription>;
  cancelSubscription(id, mode): Promise<void>;
  pauseSubscription(id): Promise<void>;
  resumeSubscription(id): Promise<void>;

  // Payment Methods
  listPaymentMethods(customerId): Promise<ProviderPaymentMethod[]>;
  detachPaymentMethod(id): Promise<void>;
  setDefaultPaymentMethod(customerId, pmId): Promise<void>;

  // Invoices
  createInvoice(data): Promise<ProviderInvoice>;
  listInvoices(customerId, filters): Promise<ProviderInvoice[]>;

  // Usage
  reportUsage(subscriptionId, metric, value): Promise<void>;

  // Webhooks
  verifyWebhook(payload, signature): boolean;
  normalizeEvent(rawEvent): PayKitEvent;
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

1. **Your DB is the source of truth.** Every `pk.api.*` call reads/writes
   your database first, then syncs with the provider. Webhook handlers
   update your database, then call your event handlers.

2. **No provider leakage.** You never see `stripeSubscriptionId` in
   business code. Provider IDs are stored internally and resolved by
   PayKit.

3. **Progressive disclosure.** Simple things are simple:
   `pk.api.createCheckout({ customerId, priceId })`. Advanced things
   are possible: proration strategies, usage caps, multi-provider routing.

4. **Type safety everywhere.** All inputs, outputs, events, and plugin
   extensions are fully typed. Plugin endpoints merge into `pk.api.*`
   types automatically.

5. **Framework-agnostic.** Core runs anywhere. Framework bindings
   (Next.js, Hono, Express) are thin adapters over the same handler.
