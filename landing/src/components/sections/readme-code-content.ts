// Hero code block — two tabs
export const heroPaykitCode = `import { feature, plan } from "paykitjs"

const messages = feature({ id: "messages", type: "metered" })
const proModels = feature({ id: "pro_models", type: "boolean" })

export const free = plan({
  id: "free",
  default: true,
  includes: [
    messages({ limit: 20, reset: "month" }),
  ],
})

export const pro = plan({
  id: "pro",
  price: { amount: 19, interval: "month" },
  includes: [
    messages({ limit: 100, reset: "month" }),
    proModels(),
  ],
})`;

// Hero config tab
export const heroConfigCode = `import { stripe } from "@paykitjs/stripe"
import { createPayKit } from "paykitjs"
import { free, pro } from "./plans"

export const paykit = createPayKit({
  database: env.DATABASE_URL,
  plans: [free, pro],
  // Connect any provider (Stripe / Polar / Creem)
  provider: stripe({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }),
  plugins: [
    dashboard() // custom plugins
  ],
  on: {
    "plan.activated": ({ customer, plan }) => {
      await sendEmail(customer.email, "Welcome to Pro!")
    },
  }
})`;

// API section tabs
export const codeExamples: Record<string, string> = {
  Subscribe: `const { url } = await paykit.subscribe({
  customerId: "user_123",
  planId: "pro",
})
// url = Stripe Checkout URL (redirect customer here)

// Upgrade — switches immediately
await paykit.subscribe({
  customerId: "user_123",
  planId: "enterprise",
})

// Downgrade — switches at end of cycle
await paykit.subscribe({
  customerId: "user_123",
  planId: "free",
})`,
  Check: `const { allowed, remaining } = await paykit.check({
  customerId: "user_123",
  featureId: "messages",
})

if (!allowed) {
  return { error: "Message limit reached. Upgrade to Pro." }
}`,
  Report: `await paykit.report({
  customerId: "user_123",
  featureId: "messages",
  amount: 1,
})`,
  Events: `const paykit = createPayKit({
  // ...
  on: {
    "customer.updated": ({ customerId, plans }) => {
      // plans = [{ id: "pro", status: "active", ... }]
    },
  },
})`,
};

export const serverCode = `import { stripe } from "@paykitjs/stripe"
import { createPayKit } from "paykitjs"
import * as plans from "./paykit.plans"

export const paykit = createPayKit({
  database: env.DATABASE_URL,
  provider: stripe({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }),
  plans,
})`;

export const handlerCode = `// app/api/paykit/[...all]/route.ts
import { paykit } from "@/server/paykit"
import { paykitHandler } from "paykitjs/handlers/next"

export const { GET, POST } = paykitHandler(paykit)`;

// Demo section — inline snippets for flow log
export const demoSnippets = {
  subscribe: `paykit.subscribe({ planId: "pro" })`,
  check: `paykit.check({ featureId: "msgs" })`,
  report: `paykit.report({ featureId: "msgs", amount: 1 })`,
  portal: `paykit.customerPortal({ returnUrl: "/" })`,
  downgrade: `paykit.subscribe({ planId: "free" })`,
  resubscribe: `paykit.subscribe({ planId: "pro" })`,
} as const;
