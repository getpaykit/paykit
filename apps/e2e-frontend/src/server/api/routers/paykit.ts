import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { paykit } from "@/server/paykit";

const demoCustomer = {
  email: "e2e@example.com",
  name: "E2E Demo Customer",
  referenceId: "e2e-demo-user",
} as const;

export const paykitRouter = createTRPCRouter({
  createCheckout: publicProcedure.mutation(async () => {
    const customer = await paykit.customer.sync(demoCustomer);

    const checkout = await paykit.checkout.create({
      providerId: "mock",
      customerId: customer.id,
      amount: 1999,
      description: "PayKit E2E checkout",
      successURL: "https://example.com/success",
      cancelURL: "https://example.com/cancel",
      attachMethod: true,
      metadata: {
        source: "apps/e2e-frontend",
      },
    });

    return {
      ...checkout,
      customerId: customer.id,
      referenceId: customer.referenceId,
    };
  }),
});
