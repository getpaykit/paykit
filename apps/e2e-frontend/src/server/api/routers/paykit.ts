import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { paykit } from "@/server/paykit";

const demoCustomer = {
  email: "e2e@example.com",
  id: "e2e-demo-user",
  name: "E2E Demo Customer",
} as const;

export const paykitRouter = createTRPCRouter({
  createCustomer: publicProcedure.mutation(async () => {
    const customer = await paykit.customers.create(demoCustomer);
    return customer;
  }),

  getCustomer: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      return paykit.customers.get({ id: input.id });
    }),

  deleteCustomer: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await paykit.customers.delete({ id: input.id });
      return { success: true };
    }),
});
