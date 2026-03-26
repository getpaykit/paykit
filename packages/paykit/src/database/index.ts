import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

import * as schema from "./schema";

export type PayKitDatabase = NodePgDatabase<typeof schema>;

const migrationsSchema = "public";
const migrationsTable = "paykit_migrations";
const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

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
