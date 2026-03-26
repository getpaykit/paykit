import { Pool } from "pg";

import { env } from "@/env";

const globalForPool = globalThis as typeof globalThis & { paykitPool?: Pool };
export const pool = globalForPool.paykitPool ?? new Pool({ connectionString: env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") {
  globalForPool.paykitPool = pool;
}
