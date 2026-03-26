export interface PlanTemplate {
  id: string;
  name: string;
  hint: string;
  content: string;
}

export const templates: PlanTemplate[] = [
  {
    id: "saas-starter",
    name: "SaaS Starter",
    hint: "free + pro monthly",
    content: `import { plan } from "paykitjs";

export const free = plan({
  id: "free",
  name: "Free",
  group: "base",
  default: true,
});

export const pro = plan({
  id: "pro",
  name: "Pro",
  group: "base",
  price: { amount: 29, interval: "month" },
});
`,
  },
  {
    id: "usage-based",
    name: "Usage Based",
    hint: "metered with limits",
    content: `import { feature, plan } from "paykitjs";

const messages = feature({ id: "messages", type: "metered" });

export const free = plan({
  id: "free",
  name: "Free",
  group: "base",
  default: true,
  includes: [messages({ limit: 100, reset: "month" })],
});

export const pro = plan({
  id: "pro",
  name: "Pro",
  group: "base",
  price: { amount: 29, interval: "month" },
  includes: [messages({ limit: 5000, reset: "month" })],
});
`,
  },
  {
    id: "empty",
    name: "Empty",
    hint: "start from scratch",
    content: `import { plan } from "paykitjs";

// export const myPlan = plan({
//   id: "my-plan",
//   name: "My Plan",
//   price: { amount: 29, interval: "month" },
// });
`,
  },
];
