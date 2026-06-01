import * as z from "zod";

import { definePayKitMethod, returnUrl } from "../api/define-route";
import { assertProviderHasCapability } from "../providers/capabilities";
import {
  getCustomerWithDetails,
  hardDeleteCustomer,
  listCustomers,
  upsertCustomer as upsertCustomerService,
  upsertProviderCustomer,
} from "./customer.service";

const upsertCustomerSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  upsertProviderCustomer: z.boolean().optional(),
});

const customerIdSchema = z.object({
  id: z.string(),
});

const listCustomersSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).optional(),
    planIds: z.array(z.string()).optional(),
  })
  .optional();

export const upsertCustomer = definePayKitMethod({ input: upsertCustomerSchema }, async (ctx) =>
  upsertCustomerService(ctx.paykit, ctx.input),
);

export const getCustomer = definePayKitMethod({ input: customerIdSchema }, async (ctx) =>
  getCustomerWithDetails(ctx.paykit, ctx.input.id),
);

export const deleteCustomer = definePayKitMethod({ input: customerIdSchema }, async (ctx) => {
  await hardDeleteCustomer(ctx.paykit, ctx.input.id);
  return { success: true };
});

export const listCustomersMethod = definePayKitMethod({ input: listCustomersSchema }, async (ctx) =>
  listCustomers(ctx.paykit, ctx.input),
);

/** Opens the provider customer portal for the resolved customer. */
export const customerPortal = definePayKitMethod(
  {
    input: z.object({
      returnUrl: returnUrl(),
    }),
    requireCustomer: true,
    route: {
      client: true,
      method: "POST",
      path: "/customer-portal",
    },
  },
  async (ctx) => {
    assertProviderHasCapability(ctx.paykit.provider, "customerPortal");
    const { providerCustomerId } = await upsertProviderCustomer(ctx.paykit, {
      customerId: ctx.customer.id,
    });

    const { url } = await ctx.paykit.provider.createCustomerPortalSession({
      providerCustomerId,
      returnUrl: ctx.input.returnUrl,
    });

    return { url };
  },
);
