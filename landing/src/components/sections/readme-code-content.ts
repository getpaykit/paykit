import type { CodeBlockProps } from "@/components/ui/code-block";

export const codeExamples: Record<string, string> = {
  Checkout: `const checkout = await paykit.api.createCheckout({
  customerId: "user_123",
  amount: 9900, // $99.00
  description: "Lifetime License",
  successURL: "https://myapp.com/success",
  cancelURL: "https://myapp.com/cancel",
  attachMethod: true,
});

// redirect user to checkout.url`,
  Subscriptions: `const subscription = await paykit.api.createSubscription({
  customerId: "user_123",
  amount: 2900, // $29/mo
  interval: "month",
  description: "Pro Plan",
  trialDays: 14,
});

// cancel at period end
await paykit.api.cancelSubscription({
  id: subscription.id,
  mode: "at_period_end",
});`,
  Events: `const paykit = createPayKit({
  // ...
  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!");
    },
    "payment.succeeded": async ({ payment }) => {
      console.log("Payment received:", payment.id);
    },
    "invoice.payment_failed": async ({ invoice, error }) => {
      await alertTeam(invoice.customerId, error);
    },
  },
});`,
  Invoices: `const invoices = await paykit.api.listInvoices({
  customerId: "user_123",
  status: "paid",
  limit: 10,
});

const invoice = await paykit.api.getInvoice({ id: "inv_abc" });
// invoice.pdfURL  → download link
// invoice.total   → amount in cents
// invoice.status  → "paid"`,
};

export const serverCode = `import { createPayKit } from "paykitjs"
import { stripe } from "@paykitjs/stripe"
import { drizzleAdapter } from "paykitjs/adapters/drizzle"

export const paykit = createPayKit({
  database: drizzleAdapter(db),

  providers: [
    stripe({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    }),
  ],

  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!")
    },
    "payment.succeeded": async ({ payment }) => {
      console.log("Payment received", payment)
    },
  },
})`;

export const handlerCode = `// app/api/paykit/[...path]/route.ts
import { paykit } from "@/lib/paykit"

// Handles webhooks and client API requests
export const { GET, POST } = paykit.handler`;

export const sharedCodeBlockProps: CodeBlockProps = {
  className:
    "border-0 my-0 shadow-none bg-neutral-50 dark:bg-background [&_div]:bg-neutral-50 [&_div]:dark:bg-background",
  keepBackground: true,
  "data-line-numbers": true,
  viewportProps: {
    className: "overflow-x-auto overflow-y-visible max-h-none",
  },
};
