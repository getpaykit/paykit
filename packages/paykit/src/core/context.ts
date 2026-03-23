import { createDatabase, type PayKitDatabase } from "../database/index";
import type { PayKitProvider } from "../providers/provider";
import type { PayKitEventHandlers } from "../types/events";
import type { PayKitOptions } from "../types/options";
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
  products: Product[];
  eventHandlers: PayKitEventHandlers;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
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
    eventHandlers: options.on ?? {},
    logger: options.logger ?? noopLogger,
  };
}
