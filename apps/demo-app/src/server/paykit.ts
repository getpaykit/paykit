import { stripe } from "@paykitjs/stripe";
import { createPayKit } from "paykitjs";

import { env } from "@/env";
import { auth } from "@/server/auth";
import { pool } from "@/server/db";
import * as plans from "@/server/paykit.plans";

export const paykit = createPayKit({
  database: pool,
  provider: stripe({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }),
  plans,
  client: {
    identify: async (request) => {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) {
        throw new Error("Not authenticated");
      }
      return {
        customerId: session.user.id,
        email: session.user.email,
        name: session.user.name ?? undefined,
      };
    },
  },
});
