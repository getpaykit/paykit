export type FeatureVariant =
  | "checkout"
  | "database"
  | "providers"
  | "subscriptions"
  | "typesafe"
  | "webhooks";

export const featureCards: Array<{
  desc: string;
  headline: string;
  href: string;
  label: string;
  variant: FeatureVariant;
}> = [
  {
    label: "Unified API",
    headline: "One API, every provider.",
    desc: "Stripe, PayPal, and regional PSPs behind a single TypeScript interface. Swap providers with config, not rewrites.",
    variant: "providers",
    href: "/docs",
  },
  {
    label: "Subscriptions",
    headline: "Provider-native, unified.",
    desc: "Create, cancel, pause, resume — using each provider's own billing engine behind one consistent API.",
    variant: "subscriptions",
    href: "/docs",
  },
  {
    label: "Checkout",
    headline: "Payments in minutes.",
    desc: "One-time payments, hosted checkout. Pass an amount and description — no product catalog needed.",
    variant: "checkout",
    href: "/docs",
  },
  {
    label: "Webhook Engine",
    headline: "Normalized events.",
    desc: "Stripe's invoice.payment_failed and PayPal's BILLING.SUBSCRIPTION.PAYMENT.FAILED both become one typed event.",
    variant: "webhooks",
    href: "/docs",
  },
  {
    label: "Your Database",
    headline: "You own the state.",
    desc: "Prisma and Drizzle adapters sync everything to your DB. Business logic reads from your tables, not provider APIs.",
    variant: "database",
    href: "/docs",
  },
  {
    label: "Type-Safe",
    headline: "End-to-end types.",
    desc: "Zod-validated inputs, typed events, plugin endpoints that merge into paykit.api.* automatically.",
    variant: "typesafe",
    href: "/docs",
  },
];
