"use client";

import { CodeBlock } from "@/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  {
    value: "subscriptions",
    label: "Subscriptions",
    code: `await pk.api.createSubscription({
  customerId: "cust_abc",
  amount: 2900,
  interval: "month",
  description: "Pro Plan",
});`,
  },
  {
    value: "checkout",
    label: "Checkout",
    code: `const checkout = await pk.api.createCheckout({
  customerId: "cust_abc",
  amount: 9900,
  description: "Lifetime License",
  successURL: "/success",
});`,
  },
  {
    value: "usage",
    label: "Usage",
    code: `await pk.api.reportUsage({
  subscriptionId: "sub_abc",
  metric: "api_calls",
  value: 1500,
});`,
  },
  {
    value: "payment-methods",
    label: "Payment Methods",
    code: `const result = await pk.api.attachPaymentMethod({
  customerId: "cust_abc",
  returnURL: "https://myapp.com/settings/billing",
});
// result.url → redirect user to provider-hosted card form

const methods = await pk.api.listPaymentMethods({ customerId: "cust_abc" });

await pk.api.setDefaultPaymentMethod({
  customerId: "cust_abc",
  paymentMethodId: "pm_xyz",
});`,
  },
  {
    value: "invoices",
    label: "Invoices",
    code: `const invoice = await pk.api.createInvoice({
  customerId: "cust_abc",
  lines: [
    { description: "Consulting — Jan 2026", amount: 50000, quantity: 1 },
    { description: "Setup fee", amount: 10000, quantity: 1 },
  ],
  dueDate: "2026-02-28",
  autoCollect: true,
});`,
  },
  {
    value: "webhooks",
    label: "Webhooks",
    code: `// Next.js — app/api/paykit/[...path]/route.ts
export const { GET, POST } = pk.handler;

// Hono
app.all("/api/paykit/*", (c) => pk.handler(c.req.raw));`,
  },
  {
    value: "events",
    label: "Events",
    code: `const pk = paykit({
  ...,
  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!");
    },
    "charge.failed": async ({ charge, customer }) => {
      await notifyTeam(\`Payment failed for \${customer.email}\`);
    },
  },
});`,
  },
];

export function CodeShowcaseSection() {
  return (
    <section>
      <div className="section-container py-24 border-b border-border">
        <h2 className="section-title text-center">
          Everything you need.
          <br />
          Nothing you don&apos;t.
        </h2>

        <Tabs defaultValue="subscriptions" className="mt-12">
          <div className="w-full overflow-x-auto">
            <TabsList
              variant="line"
              className="min-w-max w-full rounded-none border-b border-border pb-0"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none text-xs sm:text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <CodeBlock code={tab.code} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
