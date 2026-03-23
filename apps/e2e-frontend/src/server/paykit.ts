import { stripe } from "@paykitjs/stripe";
import { createPayKit, product } from "paykitjs";
import { Pool } from "pg";

import { env } from "@/env";

export const starterPack = product({
  id: "starter_pack",
  name: "Starter Pack",
  price: { amount: 1999 },
});

export const proMonthly = product({
  id: "pro_monthly",
  name: "Pro Monthly",
  price: { amount: 2200, interval: "month" },
});

const globalForPool = globalThis as typeof globalThis & { paykitPool?: Pool };
const pool = globalForPool.paykitPool ?? new Pool({ connectionString: env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") {
  globalForPool.paykitPool = pool;
}

export const paykit = createPayKit({
  database: pool,
  provider: stripe({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }),
  products: [starterPack, proMonthly],
});
