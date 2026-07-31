import * as z from "zod";

import { definePayKitMethod } from "../api/define-route";
import { addSubscriptionAddOn, removeSubscriptionAddOn } from "./subscription.service";

const addAddOnBodySchema = z.object({
  planId: z.string(),
  targetSubscriptionId: z.string().optional(),
});

const removeAddOnBodySchema = z.object({
  planId: z.string(),
});

/** Attaches an add-on plan to the customer's existing subscription, charging their saved card. */
export const addAddOn = definePayKitMethod(
  {
    input: addAddOnBodySchema,
    requireCustomer: true,
    route: {
      client: true,
      method: "POST",
      path: "/add-add-on",
    },
  },
  async (ctx) =>
    addSubscriptionAddOn(ctx.paykit, {
      customerId: ctx.customer.id,
      planId: ctx.input.planId,
      targetSubscriptionId: ctx.input.targetSubscriptionId,
    }),
);

/** Removes an active add-on plan from the customer's subscription. */
export const removeAddOn = definePayKitMethod(
  {
    input: removeAddOnBodySchema,
    requireCustomer: true,
    route: {
      client: true,
      method: "POST",
      path: "/remove-add-on",
    },
  },
  async (ctx) => {
    await removeSubscriptionAddOn(ctx.paykit, {
      customerId: ctx.customer.id,
      planId: ctx.input.planId,
    });
    return { success: true as const };
  },
);
