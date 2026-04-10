import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import * as schema from "./schema";

export type PayKitDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DrizzleAdapterInstance {
  _tag: "drizzle-adapter";
  db: PayKitDatabase;
}

export function isDrizzleAdapter(value: unknown): value is DrizzleAdapterInstance {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["_tag"] === "drizzle-adapter"
  );
}

const migrationsSchema = "public";
const migrationsTable = "paykit_migrations";
const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Resolves a `Pool` from the database option. Throws for `DrizzleAdapterInstance`
 * since CLI commands require a direct connection to run migrations.
 */
export function resolvePool(database: Pool | string | DrizzleAdapterInstance): Pool {
  if (isDrizzleAdapter(database)) {
    throw new Error(
      "The PayKit CLI requires a connection string or pg.Pool — pass a connection string or Pool for CLI usage.",
    );
  }
  return typeof database === "string" ? new Pool({ connectionString: database }) : database;
}

export async function createDatabase(database: Pool): Promise<PayKitDatabase> {
  return drizzle(database, { schema });
}

export async function migrateDatabase(database: Pool): Promise<void> {
  await migrate(drizzle(database, { schema }), {
    migrationsFolder,
    migrationsSchema,
    migrationsTable,
  });
}

export async function getPendingMigrationCount(database: Pool): Promise<number> {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: readonly { tag: string }[];
  };
  const totalMigrations = journal.entries.length;

  try {
    const result = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${migrationsSchema}.${migrationsTable}`,
    );
    const appliedCount = result.rows[0]?.count ?? 0;
    return Math.max(0, totalMigrations - appliedCount);
  } catch {
    // Table doesn't exist yet — all migrations are pending
    return totalMigrations;
  }
}
