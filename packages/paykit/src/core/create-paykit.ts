import type { PayKitProvider } from "../providers/provider";
import { createCharge } from "../services/charge-service";
import { createCheckout } from "../services/checkout-service";
import { deleteCustomerById, getCustomerById, syncCustomer } from "../services/customer-service";
import {
  attachPaymentMethod,
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
} from "../services/payment-method-service";
import type { PayKitInstance } from "../types/instance";
import type { PayKitOptions, ProviderId } from "../types/options";
import { handleWebhook } from "../webhook/handle-webhook";
import { createScopedInstance } from "./as-customer";
import { createContext, type PayKitContext } from "./context";
import { attachPayKitInternalState } from "./internal";

export function createPayKit<const TProviders extends readonly PayKitProvider[]>(
  options: PayKitOptions<TProviders>,
): PayKitInstance<ProviderId<TProviders>> {
  let contextPromise: Promise<PayKitContext<ProviderId<TProviders>, TProviders>> | undefined;
  const getContext = () => {
    contextPromise ??= createContext(options);
    return contextPromise;
  };

  const instance: PayKitInstance<ProviderId<TProviders>> = {
    customer: {
      async sync(input) {
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
    charge: {
      async create(input) {
        const ctx = await getContext();
        return createCharge(ctx, input);
      },
    },
    checkout: {
      async create(input) {
        const ctx = await getContext();
        return createCheckout(ctx, input);
      },
    },
    paymentMethod: {
      async attach(input) {
        const ctx = await getContext();
        return attachPaymentMethod(ctx, input);
      },
      async list(input) {
        const ctx = await getContext();
        return listPaymentMethods(ctx, input);
      },
      async setDefault(input) {
        const ctx = await getContext();
        await setDefaultPaymentMethod(ctx, input);
      },
      async detach(input) {
        const ctx = await getContext();
        await detachPaymentMethod(ctx, input);
      },
    },
    async handleWebhook(input) {
      const ctx = await getContext();
      return handleWebhook(ctx, input);
    },
    asCustomer(identity) {
      // Scoped methods auto-upsert customer before each operation.
      return {
        charge: {
          async create(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            return scoped.charge.create(input);
          },
        },
        checkout: {
          async create(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            return scoped.checkout.create(input);
          },
        },
        paymentMethod: {
          async attach(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            return scoped.paymentMethod.attach(input);
          },
          async list(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            return scoped.paymentMethod.list(input);
          },
          async setDefault(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            await scoped.paymentMethod.setDefault(input);
          },
          async detach(input) {
            const ctx = await getContext();
            const scoped = createScopedInstance(ctx, identity);
            await scoped.paymentMethod.detach(input);
          },
        },
      };
    },
    get $context() {
      return getContext();
    },
  };

  return attachPayKitInternalState(instance, {
    database: options.database,
  });
}
