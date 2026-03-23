import type { Pool } from "pg";

import type { PayKitProvider } from "../providers/provider";
import type { PayKitEventHandlers } from "./events";
import type { Product } from "./product";

export interface PayKitOptions {
  database: Pool;
  provider: PayKitProvider;
  products?: Product[];
  on?: PayKitEventHandlers;
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}
