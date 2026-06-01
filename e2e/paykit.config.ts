import { polar } from "@paykitjs/polar";
import { stripe } from "@paykitjs/stripe";
import { createPayKit } from "paykitjs";
import { Pool } from "pg";

import { env } from "./test-utils/env";
import { allProducts } from "./test-utils/products";

function createProvider() {
  if (env.PROVIDER === "polar") {
    if (!env.E2E_POLAR_ACCESS_TOKEN || !env.E2E_POLAR_WHSEC) {
      throw new Error("E2E_POLAR_ACCESS_TOKEN and E2E_POLAR_WHSEC must be set");
    }

    return polar({
      accessToken: env.E2E_POLAR_ACCESS_TOKEN,
      webhookSecret: env.E2E_POLAR_WHSEC,
      server: "sandbox",
    });
  }

  if (!env.E2E_STRIPE_SK || !env.E2E_STRIPE_WHSEC) {
    throw new Error("E2E_STRIPE_SK and E2E_STRIPE_WHSEC must be set");
  }

  return stripe({
    secretKey: env.E2E_STRIPE_SK,
    webhookSecret: env.E2E_STRIPE_WHSEC,
  });
}

export const paykit = createPayKit({
  database: new Pool({ connectionString: env.TEST_DATABASE_URL }),
  products: allProducts,
  provider: createProvider(),
  testing: { enabled: true },
});

export default paykit;
