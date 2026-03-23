import { fileURLToPath } from "node:url";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

import type { PayKitDatabaseAdapter } from "../adapter";
import * as schema from "./schema";

export type PostgresPayKitDatabase = NodePgDatabase<typeof schema>;

const migrationsSchema = "public";
const migrationsTable = "paykit_migrations";

export const postgresDatabaseAdapter: PayKitDatabaseAdapter<Pool> = {
  supports(value): value is Pool {
    return (
      typeof value === "object" &&
      value !== null &&
      "connect" in value &&
      typeof value.connect === "function" &&
      "query" in value &&
      typeof value.query === "function"
    );
  },

  async createDatabase(pool) {
    return drizzle(pool, { schema });
  },

  async migrate(pool) {
    await migrate(drizzle(pool, { schema }), {
      migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
      migrationsSchema,
      migrationsTable,
    });
  },
};
