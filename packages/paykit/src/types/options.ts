import type { Pool } from "pg";

import type { PayKitProvider } from "../providers/provider";
import type { PayKitEventHandlers } from "./events";
import type { Product } from "./product";

export interface PayKitLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface PayKitOptions {
  database: Pool;
  provider: PayKitProvider;
  products?: readonly Product[];
  basePath?: string;
  client?: {
    identify?: (request: Request) => Promise<{
      customerId: string;
      email?: string;
      name?: string;
    }>;
  };
  on?: PayKitEventHandlers;
  logger?: PayKitLogger;
}
