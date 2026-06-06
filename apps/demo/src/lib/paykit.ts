import { createPayKit } from "paykitjs";

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { free, pro, ultra } from "@/lib/paykit-products";
import { paykitPool } from "@/server/db";

export const paykit = createPayKit({
  basePath: "/paykit",
  database: paykitPool,
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  testing: { enabled: true },
  products: [pro, ultra, free],
  identify: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    return {
      customerId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
    };
  },
});

export type PayKit = (typeof paykit)["$infer"];
export type PayKitInstance = typeof paykit;
