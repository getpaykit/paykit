import { migrateDatabase, resolvePool } from "../../database";
import type { PayKitOptions } from "../../types/options";

export async function runPayKitMigrations(config: { options: PayKitOptions }): Promise<void> {
  const pool = resolvePool(config.options.database);

  try {
    await migrateDatabase(pool);
  } finally {
    await pool.end();
  }
}
