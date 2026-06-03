// Hero code block — two tabs
export const heroPaykitCode = `import { feature, plan } from "paykitjs"

const messages = feature({ id: "msgs", type: "metered" })
const proModels = feature({ id: "pros", type: "boolean" })

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
export const heroConfigCode = `import { createPayKit } from "paykitjs"
import { free, pro } from "./products"

export const paykit = createPayKit({
  database: env.DATABASE_URL,
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  products: [free, pro],
  on: {
    "subscription.activated": async ({ customer, plan })  => {
      await sendEmail(customer.email, "Welcome to Pro!")
    },
  }
})`;

// Demo section — inline snippets for flow log
export const demoSnippets = {
  subscribe: `paykit.subscribe({ planId: "pro" })`,
  check: `paykit.check({ featureId: "msgs" })`,
  report: `paykit.report({ featureId: "msgs", amount: 1 })`,
  portal: `paykit.customerPortal({ returnUrl: "/" })`,
  downgrade: `paykit.subscribe({ planId: "free" })`,
  resubscribe: `paykit.subscribe({ planId: "pro" })`,
} as const;
