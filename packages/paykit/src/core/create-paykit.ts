import { deleteCustomerById, getCustomerById, syncCustomer } from "../services/customer-service";
import type { PayKitInstance } from "../types/instance";
import type { PayKitOptions } from "../types/options";
import { handleWebhook } from "../webhook/handle-webhook";
import { createContext, type PayKitContext } from "./context";
import { attachPayKitInternalState } from "./internal";

export function createPayKit(options: PayKitOptions): PayKitInstance {
  let contextPromise: Promise<PayKitContext> | undefined;
  const getContext = () => {
    contextPromise ??= createContext(options);
    return contextPromise;
  };

  const instance: PayKitInstance = {
    customers: {
      async create(input) {
        const ctx = await getContext();
        return syncCustomer(ctx.database, input);
      },
      async get(input) {
        const ctx = await getContext();
        return getCustomerById(ctx.database, input.id);
      },
      async delete(input) {
        const ctx = await getContext();
        await deleteCustomerById(ctx.database, input.id);
      },
    },
    async handleWebhook(input) {
      const ctx = await getContext();
      return handleWebhook(ctx, input);
    },
    get $context() {
      return getContext();
    },
  };

  return attachPayKitInternalState(instance, {
    database: options.database,
    provider: options.provider,
    products: options.products ?? [],
  });
}
