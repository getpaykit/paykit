# PayKit — Landing Page Design

> MVP validation page. Single page. Goal: get developers to
> star the repo or join a waitlist.

## Structure

```
1. Hero          — headline + init code + CTA
2. Why           — 3 pain-point cards
3. Code showcase — tabbed API examples
4. Footer CTA    — repeat CTA
```

---

## 1. Hero

**Headline:**
Payments orchestration for modern SaaS.

**Subheadline:**
One TypeScript API. Any provider. Your database is the source of truth.

**CTA:** `Star on GitHub` (secondary: `Join Waitlist` if collecting emails)

**Code block** — the init config. This is 90% of the pitch. A developer
reads 12 lines and understands the entire mental model:

```typescript
import { paykit } from "paykit";
import { stripe } from "@paykit/stripe";
import { prisma } from "@paykit/prisma";

const pk = paykit({
  database: prisma(client),
  providers: [
    stripe({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  ],
});
```

---

## 2. Why

**Headline:**
Providers are payment rails. Your database owns the rest.

Three cards, each one sentence:

- **No vendor lock-in.** Subscriptions, invoices, and usage live in
  your DB. Swap providers without rewriting billing logic.
- **No product catalog syncing.** Pass amounts inline. Your app owns
  its products — PayKit doesn't need to know about them.
- **Tiny provider contract.** 5 methods. Adding a new provider takes
  an afternoon.

---

## 3. Code Showcase

**Headline:**
Everything you need. Nothing you don't.

Tabbed code block. Seven tabs:

**Subscriptions** (default):

```typescript
await pk.api.createSubscription({
  customerId: "cust_abc",
  amount: 2900,
  interval: "month",
  description: "Pro Plan",
});
```

**Checkout:**

```typescript
const checkout = await pk.api.createCheckout({
  customerId: "cust_abc",
  amount: 9900,
  description: "Lifetime License",
  successURL: "/success",
});
```

**Usage:**

```typescript
await pk.api.reportUsage({
  subscriptionId: "sub_abc",
  metric: "api_calls",
  value: 1500,
});
```

**Payment Methods:**

```typescript
const result = await pk.api.attachPaymentMethod({
  customerId: "cust_abc",
  returnURL: "https://myapp.com/settings/billing",
});
// result.url -> redirect user to provider-hosted card form

const methods = await pk.api.listPaymentMethods({ customerId: "cust_abc" });

await pk.api.setDefaultPaymentMethod({
  customerId: "cust_abc",
  paymentMethodId: "pm_xyz",
});
```

**Invoices:**

```typescript
const invoice = await pk.api.createInvoice({
  customerId: "cust_abc",
  lines: [
    { description: "Consulting — Jan 2026", amount: 50000, quantity: 1 },
    { description: "Setup fee", amount: 10000, quantity: 1 },
  ],
  dueDate: "2026-02-28",
  autoCollect: true,
});

const invoices = await pk.api.listInvoices({
  customerId: "cust_abc",
  status: "paid",
});
```

**Webhooks:**

```typescript
// Next.js — app/api/paykit/[...path]/route.ts
export const { GET, POST } = pk.handler;

// Hono
app.all("/api/paykit/*", (c) => pk.handler(c.req.raw));
```

**Events:**

```typescript
const pk = paykit({
  // ...
  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!");
    },
    "charge.failed": async ({ charge, customer }) => {
      await notifyTeam(`Payment failed for ${customer.email}`);
    },
  },
});
```

---

## 4. Footer CTA

**Headline:**
Open source. TypeScript-first. Coming soon.

Same CTA as hero: `Star on GitHub` / `Join Waitlist`

---

## Design Decisions

- **No feature grid.** Code blocks ARE the feature list. Method names
  are self-documenting.
- **No testimonials / logos.** No users yet. GitHub stars badge is the
  early-stage substitute.
- **No pricing.** OSS core, paid stuff is future.
- **No architecture diagrams.** The init code shows the architecture
  (database + providers in, API out).
- **No deep-dive sections.** This is a validation page, not docs.
- **Tabs over scroll.** Developer clicks what they care about, skips
  the rest.

## References

Pattern validated against: Better-auth, Resend, Next.js, Polar, Vercel.
All follow Hero → Social proof → Code → Features → Testimonials → CTA.
This design is that template minus everything that requires an existing
user base.


## Style

Want it to look clean and minimalistic, like Vercel, or Drizzle. 
Have limited container width, and defined sections, like vercel.
Have blocks with borders, modern style, like better-auth.
Have code examples.
