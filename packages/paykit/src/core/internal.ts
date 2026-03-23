import type { Pool } from "pg";

import type { PayKitProvider } from "../providers/provider";
import type { Product } from "../types/product";

export const payKitInternalSymbol = Symbol.for("paykitjs.internal");

export interface PayKitInternalState {
  database: Pool;
  provider: PayKitProvider;
  products: Product[];
}

export function attachPayKitInternalState<T extends object>(
  instance: T,
  state: PayKitInternalState,
): T {
  Object.defineProperty(instance, payKitInternalSymbol, {
    configurable: false,
    enumerable: false,
    value: state,
    writable: false,
  });

  return instance;
}

export function getPayKitInternalState(value: unknown): PayKitInternalState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const state = (value as Record<PropertyKey, unknown>)[payKitInternalSymbol];
  if (!state || typeof state !== "object") {
    return null;
  }

  const database = (state as { database?: unknown }).database;
  if (!database || typeof database !== "object") {
    return null;
  }

  return state as PayKitInternalState;
}
