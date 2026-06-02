import { Pool } from "pg";

import { env } from "@/env";

const globalForPool = globalThis as typeof globalThis & {
  demoAuthPool?: Pool;
  demoPaykitPool?: Pool;
};

export const authPool =
  globalForPool.demoAuthPool ?? new Pool({ connectionString: env.AUTH_DATABASE_URL });

export const paykitPool =
  globalForPool.demoPaykitPool ?? new Pool({ connectionString: env.PAYKIT_DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForPool.demoAuthPool = authPool;
  globalForPool.demoPaykitPool = paykitPool;
}
