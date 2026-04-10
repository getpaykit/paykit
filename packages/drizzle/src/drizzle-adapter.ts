import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { DrizzleAdapterInstance } from "paykitjs";
import type * as schema from "paykitjs/schema";

export type { DrizzleAdapterInstance } from "paykitjs";

/**
 * Wraps an existing Drizzle PostgreSQL database instance for use with PayKit.
 * Works with any Drizzle PostgreSQL driver (node-postgres, postgres.js, Neon, Vercel Postgres, etc.).
 * The schema must include all PayKit tables — import and spread `paykitjs/schema` into your Drizzle setup.
 *
 * @example
 * ```ts
 * import * as paykitSchema from "paykitjs/schema"
 * // node-postgres
 * const db = drizzle(pool, { schema: { ...paykitSchema, ...mySchema } })
 * // postgres.js
 * const db = drizzle(sql, { schema: { ...paykitSchema, ...mySchema } })
 * // Neon serverless
 * const db = drizzle(neon(connectionString), { schema: { ...paykitSchema, ...mySchema } })
 * createPayKit({ database: drizzleAdapter(db), ... })
 * ```
 */
export function drizzleAdapter<TSchema extends typeof schema>(
  db: PgDatabase<PgQueryResultHKT, TSchema>,
): DrizzleAdapterInstance {
  return {
    _tag: "drizzle-adapter",
    db: db as unknown as PgDatabase<PgQueryResultHKT, typeof schema>,
  };
}
