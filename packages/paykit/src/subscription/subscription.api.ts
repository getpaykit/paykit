import { definePayKitMethod } from "../api/define-route";
import { subscribeToPlan } from "./subscription.service";
import { subscribeBodySchema } from "./subscription.types";

/** Applies a subscription change for the resolved customer. */
export const subscribe = definePayKitMethod(
  {
    input: subscribeBodySchema,
    requireCustomer: true,
    route: {
      client: true,
      method: "POST",
      path: "/subscribe",
    },
  },
  async (ctx) => {
    return subscribeToPlan(ctx.paykit, {
      addOnPlanIds: ctx.input.addOnPlanIds,
      customerId: ctx.customer.id,
      forceCheckout: ctx.input.forceCheckout,
      planId: ctx.input.planId,
      successUrl: ctx.input.successUrl,
      cancelUrl: ctx.input.cancelUrl,
    });
  },
);
