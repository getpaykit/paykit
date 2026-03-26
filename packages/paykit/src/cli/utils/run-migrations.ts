import { migrateDatabase } from "../../database";
import type { PayKitOptions } from "../../types/options";

export async function runPayKitMigrations(config: { options: PayKitOptions }): Promise<void> {
  await migrateDatabase(config.options.database);
}
