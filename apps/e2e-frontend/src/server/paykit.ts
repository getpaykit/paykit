import { stripe } from "@paykitjs/stripe";
import { createPayKit } from "paykitjs";
import { Pool } from "pg";

import { env } from "@/env";

function createPayKitInstance(pool: Pool) {
  return createPayKit({
    database: pool,
    on: {
      "checkout.completed": ({ payload }) => {
        console.info("[paykit] checkout.completed", payload);
      },
      "payment.succeeded": ({ payload }) => {
        console.info("[paykit] payment.succeeded", payload);
      },
    },
    providers: [
      stripe({
        currency: "usd",
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      }),
    ],
  });
}

type AppPayKit = ReturnType<typeof createPayKitInstance>;

const globalForPayKit = globalThis as typeof globalThis & {
  paykitPool?: Pool;
  paykitInstance?: AppPayKit;
};

const pool =
  globalForPayKit.paykitPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

const paykit = globalForPayKit.paykitInstance ?? createPayKitInstance(pool);

if (process.env.NODE_ENV !== "production") {
  globalForPayKit.paykitPool = pool;
  globalForPayKit.paykitInstance = paykit;
}

export { paykit };
