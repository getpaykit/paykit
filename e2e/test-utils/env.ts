import path from "node:path";

import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import * as z from "zod";

config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });
config({
  path: path.resolve(import.meta.dirname, "../../.env.local"),
  override: true,
  quiet: true,
});

export const env = createEnv({
  server: {
    PROVIDER: z.enum(["stripe", "polar", "dodopayments"]).default("stripe"),
    TEST_DATABASE_URL: z.string().default("postgresql://localhost:5432/postgres"),

    // Stripe
    E2E_STRIPE_SK: z.string().optional(),
    E2E_STRIPE_WHSEC: z.string().optional(),

    // Polar
    E2E_POLAR_ACCESS_TOKEN: z.string().optional(),
    E2E_POLAR_WHSEC: z.string().optional(),

    // DodoPayments
    E2E_DODO_BEARER_TOKEN: z.string().optional(),
    E2E_DODO_WEBHOOK_SECRET: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
