import { feature, plan } from "paykitjs";

const messagesFeature = feature({ id: "messages", type: "metered" });
const dashboardFeature = feature({ id: "dashboard", type: "boolean" });
const adminFeature = feature({ id: "admin", type: "boolean" });
const apiCallsFeature = feature({ id: "api_calls", type: "metered" });

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

export const meteredUsagePlan = plan({
  group: "usage",
  id: "metered_usage",
  name: "Metered Usage",
  price: { interval: "month", meteredBy: apiCallsFeature, unitAmount: 0.01 },
});

export const allProducts = [
  freePlan,
  proPlan,
  premiumPlan,
  ultraPlan,
  extraMessagesPlan,
  meteredUsagePlan,
] as const;
