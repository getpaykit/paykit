import { feature, plan } from "paykitjs";

const messagesFeature = feature({
  id: "messages",
  type: "metered",
});

const proModelsFeature = feature({
  id: "pro_models",
  type: "boolean",
});

const prioritySupportFeature = feature({
  id: "priority_support",
  type: "boolean",
});

export const free = plan({
  default: true,
  group: "base",
  id: "free",
  name: "Free",
  includes: [messagesFeature({ limit: 100, reset: "month" })],
});

export const pro = plan({
  group: "base",
  id: "pro",
  name: "Pro",
  includes: [messagesFeature({ limit: 2_000, reset: "month" }), proModelsFeature()],
  price: { amount: 19, interval: "month" },
});

export const ultra = plan({
  group: "base",
  id: "ultra",
  name: "Ultra",
  includes: [
    messagesFeature({ limit: 10_000, reset: "month" }),
    proModelsFeature(),
    prioritySupportFeature(),
  ],
  price: { amount: 49, interval: "month" },
});
