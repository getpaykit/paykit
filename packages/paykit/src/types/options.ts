import type { Pool } from "pg";
import type { LevelWithSilent, Logger } from "pino";

import type { PayKitProvider } from "../providers/provider";
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
  provider: PayKitProvider;
  products?: PayKitProductsModule;
  /**
   * PayKit root path, e.g. `/paykit` or `/billing`.
   * API routes are exposed under `${basePath}/api` and webhooks under `${basePath}/webhook`.
   * @default "/paykit"
   */
  basePath?: string;
  /**
   * Allowlist of origins that PayKit may trust when resolving relative return URLs.
   * Useful to prevent host header spoofing when `successUrl`, `cancelUrl`, or `returnUrl`
   * are provided as absolute paths like `/billing/success`.
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
