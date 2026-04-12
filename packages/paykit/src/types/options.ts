import type { Pool } from "pg";
import type { LevelWithSilent, Logger } from "pino";

import type { StripeProviderConfig } from "../providers/provider";
import type { PayKitSecondaryStorage } from "../secondary-storage/options";
import type { PayKitEventHandlers } from "./events";
import type { PayKitPlugin } from "./plugin";
import type { PayKitPlansModule } from "./schema";

export interface PayKitLoggingOptions {
  level?: LevelWithSilent;
  logger?: Logger;
}

export interface PayKitTestingOptions {
  enabled: true;
}

export interface PayKitOptions {
  database: Pool | string;
  provider: StripeProviderConfig;
  plans?: PayKitPlansModule;
  basePath?: string;
  identify?: (request: Request) => Promise<{
    customerId: string;
    email?: string;
    name?: string;
  } | null>;
  on?: PayKitEventHandlers;
  plugins?: PayKitPlugin[];
  secondaryStorage?: PayKitSecondaryStorage;
  logging?: PayKitLoggingOptions;
  testing?: PayKitTestingOptions;
}
