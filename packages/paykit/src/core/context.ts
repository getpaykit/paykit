import { Pool } from "pg";

import { createDatabase, isDrizzleAdapter, type PayKitDatabase } from "../database/index";
import type { StripeProviderConfig, StripeRuntime } from "../providers/provider";
import { createStripeRuntime } from "../providers/stripe";
import type { PayKitOptions } from "../types/options";
import { normalizeSchema, type NormalizedSchema } from "../types/schema";
import { PayKitError, PAYKIT_ERROR_CODES } from "./errors";
import { createPayKitLogger, type PayKitInternalLogger } from "./logger";

export interface PayKitContext {
  options: PayKitOptions;
  database: PayKitDatabase;
  provider: StripeProviderConfig;
  stripe: StripeRuntime;
  plans: NormalizedSchema;
  logger: PayKitInternalLogger;
}

export async function createContext(options: PayKitOptions): Promise<PayKitContext> {
  if (!options.provider) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_REQUIRED);
  }

  if (options.basePath && !options.basePath.startsWith("/")) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.BASEPATH_INVALID,
      `basePath must start with "/", received "${options.basePath}"`,
    );
  }

  let database: PayKitDatabase;
  if (isDrizzleAdapter(options.database)) {
    database = options.database.db;
  } else {
    const pool =
      typeof options.database === "string"
        ? new Pool({ connectionString: options.database })
        : options.database;
    database = await createDatabase(pool);
  }
  const stripe = options.provider.runtime ?? createStripeRuntime(options.provider);

  return {
    options,
    database,
    provider: options.provider,
    stripe,
    plans: normalizeSchema(options.plans),
    logger: createPayKitLogger(options.logging),
  };
}
