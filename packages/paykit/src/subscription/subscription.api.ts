import { definePayKitMethod } from "../api/define-route";
import { cancelPlanSubscription, subscribeToPlan } from "./subscription.service";
import { cancelSubscriptionBodySchema, subscribeBodySchema } from "./subscription.types";

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
      customerId: ctx.customer.id,
      forceCheckout: ctx.input.forceCheckout,
      planId: ctx.input.planId,
      successUrl: ctx.input.successUrl,
      cancelUrl: ctx.input.cancelUrl,
    });
  },
);

/** Cancels the current paid subscription for the plan's group. */
export const cancelSubscription = definePayKitMethod(
  {
    input: cancelSubscriptionBodySchema,
    requireCustomer: true,
    route: {
      client: true,
      method: "POST",
      path: "/cancel-subscription",
    },
  },
  async (ctx) => {
    return cancelPlanSubscription(ctx.paykit, {
      customerId: ctx.customer.id,
      planId: ctx.input.planId,
    });
  },
);
