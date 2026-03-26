import { betterAuth } from "better-auth";

import { env } from "@/env";
import { pool } from "@/server/db";

export const auth = betterAuth({
  baseURL: env.APP_URL,
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
});
