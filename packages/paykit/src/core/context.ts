import { createDatabase, type PayKitDatabase } from "../database/index";
import type { PayKitProvider } from "../providers/provider";
import type { PayKitLogger, PayKitOptions } from "../types/options";
import type { Product } from "../types/product";

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface PayKitContext {
  options: PayKitOptions;
  database: PayKitDatabase;
  provider: PayKitProvider;
  products: readonly Product[];
  logger: PayKitLogger;
}

export async function createContext(options: PayKitOptions): Promise<PayKitContext> {
  if (!options.provider) {
    throw new Error("A provider is required");
  }

  const database = await createDatabase(options.database);

  return {
    options,
    database,
    provider: options.provider,
    products: options.products ?? [],
    logger: options.logger ?? noopLogger,
  };
}
