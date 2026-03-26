import { createDatabase, type PayKitDatabase } from "../database/index";
import type { StripeProviderConfig, StripeRuntime } from "../providers/provider";
import { createStripeRuntime } from "../providers/stripe";
import type { PayKitLogger, PayKitOptions } from "../types/options";
import { normalizeSchema, type NormalizedSchema } from "../types/schema";

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface PayKitContext {
  options: PayKitOptions;
  database: PayKitDatabase;
  provider: StripeProviderConfig;
  stripe: StripeRuntime;
  plans: NormalizedSchema;
  logger: PayKitLogger;
}

export async function createContext(options: PayKitOptions): Promise<PayKitContext> {
  if (!options.provider) {
    throw new Error("A provider is required");
  }

  const database = await createDatabase(options.database);
  const stripe = options.provider.runtime ?? createStripeRuntime(options.provider);

  return {
    options,
    database,
    provider: options.provider,
    stripe,
    plans: normalizeSchema(options.plans),
    logger: options.logger ?? noopLogger,
  };
}
