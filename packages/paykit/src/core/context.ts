import { createDatabase, type PayKitDatabase } from "../database/index";
import type { PayKitProvider } from "../providers/provider";
import type { PayKitEventHandlers } from "../types/events";
import type { PayKitOptions, ProviderId } from "../types/options";

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface PayKitContext<
  TProviderId extends string = string,
  TProviders extends readonly PayKitProvider[] = readonly PayKitProvider[],
> {
  options: PayKitOptions<TProviders>;
  database: PayKitDatabase;
  providers: Map<TProviderId, PayKitProvider>;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  eventHandlers: PayKitEventHandlers;
}

export async function createContext<const TProviders extends readonly PayKitProvider[]>(
  options: PayKitOptions<TProviders>,
): Promise<PayKitContext<ProviderId<TProviders>, TProviders>> {
  if (options.providers.length === 0) {
    throw new Error("At least one provider is required");
  }
  const providers = new Map<ProviderId<TProviders>, PayKitProvider>();
  for (const provider of options.providers) {
    providers.set(provider.id as ProviderId<TProviders>, provider);
  }

  const database = await createDatabase(options.database);

  return {
    options,
    database,
    providers,
    logger: options.logger ?? noopLogger,
    eventHandlers: options.on ?? {},
  };
}
