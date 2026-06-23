import { Pool } from "pg";

import { createDatabase, type PayKitDatabase } from "../database/index";
import type { PaymentProvider } from "../providers/provider";
import { getStripeCurrency } from "../stripe/currency";
import { createStripeAdapter } from "../stripe/stripe-provider";
import type { PayKitOptions } from "../types/options";
import { normalizeSchema, type NormalizedSchema } from "../types/schema";
import { PayKitError, PAYKIT_ERROR_CODES } from "./errors";
import { createPayKitLogger, type PayKitInternalLogger } from "./logger";

export interface PayKitContext {
  options: PayKitOptions;
  basePath: string;
  database: PayKitDatabase;
  provider: PaymentProvider;
  products: NormalizedSchema;
  logger: PayKitInternalLogger;
}

export async function createContext(options: PayKitOptions): Promise<PayKitContext> {
  if (!options.stripe) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.PROVIDER_REQUIRED);
  }

  if (options.basePath && !options.basePath.startsWith("/")) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.BASEPATH_INVALID,
      `basePath must start with "/", received "${options.basePath}"`,
    );
  }

  const pool =
    typeof options.database === "string"
      ? new Pool({ connectionString: options.database })
      : options.database;
  const database = await createDatabase(pool);
  const provider = createStripeAdapter(options.stripe);
  const basePath = options.basePath ?? "/paykit";

  return {
    options,
    basePath,
    database,
    provider,
    products: normalizeSchema(options.products, {
      priceCurrency: getStripeCurrency(options.stripe),
    }),
    logger: createPayKitLogger(options.logging),
  };
}
