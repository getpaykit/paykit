import { createPayKitRouter, getEndpoints } from "../api";
import type { PayKitAPI, PayKitInstance } from "../types/instance";
import type { PayKitOptions } from "../types/options";
import { handleWebhook } from "../webhook/handle-webhook";
import { createContext, type PayKitContext } from "./context";

const payKitInstanceSymbol = Symbol.for("paykit.instance");

export function isPayKitInstance(value: unknown): value is PayKitInstance {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<PropertyKey, unknown>)[payKitInstanceSymbol] === true
  );
}

export function createPayKit<const TOptions extends PayKitOptions>(
  options: TOptions,
): PayKitInstance<TOptions> {
  let contextPromise: Promise<PayKitContext> | undefined;
  const getContext = () => {
    contextPromise ??= createContext(options);
    return contextPromise;
  };

  const paykit: PayKitInstance<TOptions> = {
    options,

    async handler(request: Request) {
      const ctx = await getContext();
      const router = createPayKitRouter(ctx, options);
      return router.handler(request);
    },

    get api() {
      return getEndpoints(getContext()) as unknown as PayKitAPI<TOptions>;
    },

    async checkout(input) {
      const api = getEndpoints(getContext()) as unknown as PayKitAPI<TOptions>;
      return api.checkout({ body: input });
    },

    async handleWebhook(input) {
      const ctx = await getContext();
      return handleWebhook(ctx, input);
    },

    get $context() {
      return getContext();
    },
  };

  Object.defineProperty(paykit, payKitInstanceSymbol, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return paykit;
}
