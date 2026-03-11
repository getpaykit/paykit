import type { Pool } from "pg";

import { postgresDatabaseAdapter, type PostgresPayKitDatabase } from "./postgres/postgres.adapter";

export type PayKitDatabase = PostgresPayKitDatabase;

const databaseAdapters = [postgresDatabaseAdapter] as const;

export function resolveDatabaseAdapter(database: unknown) {
  const adapter = databaseAdapters.find((candidate) => candidate.supports(database));
  if (!adapter) {
    throw new Error("Unsupported PayKit database client.");
  }

  return adapter;
}

export async function createDatabase(database: Pool): Promise<PayKitDatabase> {
  return resolveDatabaseAdapter(database).createDatabase(database);
}

export async function migrateDatabase(database: Pool): Promise<void> {
  await resolveDatabaseAdapter(database).migrate(database);
}
