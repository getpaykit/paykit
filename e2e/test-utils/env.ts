import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import "../../scripts/load-root-env.js";

export const env = createEnv({
  server: {
    PROVIDER: z.enum(["stripe"]).default("stripe"),
    TEST_DATABASE_URL: z.string().min(1),

    // Stripe
    E2E_STRIPE_SK: z.string().optional(),
    E2E_STRIPE_WHSEC: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
