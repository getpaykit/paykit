import * as z from "zod";

import { definePayKitMethod } from "../api/define-route";
import { reportUsageToProvider } from "./usage.service";

const reportUsageBodySchema = z.object({
  featureId: z.string(),
  quantity: z.number().positive().optional(),
  eventId: z.string().optional(),
});

/** Reports a Stripe usage-based billing event for the resolved customer's metered plan. */
export const reportUsage = definePayKitMethod(
  {
    input: reportUsageBodySchema,
    requireCustomer: true,
  },
  async (ctx) =>
    reportUsageToProvider(ctx.paykit, {
      customerId: ctx.customer.id,
      eventId: ctx.input.eventId,
      featureId: ctx.input.featureId,
      quantity: ctx.input.quantity,
    }),
);
