import type { Pool } from "pg";
import type { LevelWithSilent, Logger } from "pino";

import type { StripeOptions } from "../stripe/stripe-provider";
import type { PayKitEventHandlers } from "./events";
import type { PayKitPlugin } from "./plugin";
import type { PayKitProductsModule } from "./schema";

export interface PayKitLoggingOptions {
  level?: LevelWithSilent;
  logger?: Logger;
}

export interface PayKitTestingOptions {
  enabled: true;
}

export interface PayKitOptions {
  database: Pool | string;
  stripe: StripeOptions;
  /**
   * @deprecated PayKit is Stripe-only. Use `stripe` instead.
   */
  provider?: never;
  products?: PayKitProductsModule;
  /**
   * PayKit root path, e.g. `/paykit` or `/billing`.
   * API routes are exposed under `${basePath}/api` and webhooks under `${basePath}/webhook`.
   * @default "/paykit"
   */
  basePath?: string;
  /**
   * Additional browser origins trusted by PayKit.
   * Configure this when the frontend and PayKit API use different origins.
   */
  trustedOrigins?: string[];
  identify?: (request: Request) => Promise<{
    customerId: string;
    email?: string;
    name?: string;
  } | null>;
  on?: PayKitEventHandlers;
  plugins?: PayKitPlugin[];
  logging?: PayKitLoggingOptions;
  testing?: PayKitTestingOptions;
}

export type ExactOptions<TOptions extends PayKitOptions> = TOptions &
  Record<Exclude<keyof TOptions, keyof PayKitOptions>, never>;
