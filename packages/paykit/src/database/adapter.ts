import type { PayKitDatabase } from "./index";

export interface PayKitDatabaseAdapter<TClient> {
  supports(value: unknown): value is TClient;
  createDatabase(client: TClient): Promise<PayKitDatabase>;
  migrate(client: TClient): Promise<void>;
}
