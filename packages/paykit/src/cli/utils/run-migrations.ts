import type { PayKitInternalState } from "../../core/internal";
import { migrateDatabase } from "../../database";

export async function runPayKitMigrations(config: { state: PayKitInternalState }): Promise<void> {
  await migrateDatabase(config.state.database);
}
