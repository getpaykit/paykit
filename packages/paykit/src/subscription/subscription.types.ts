import * as z from "zod";

import { returnUrl } from "../api/define-route";
import type { StoredSubscription } from "../types/models";

export const subscribeBodySchema = z
  .object({
    planId: z.string(),
    /** Additional plan IDs to combine with `planId` into one checkout (e.g. add-ons). */
    addOnPlanIds: z
      .array(z.string())
      .max(10, "At most 10 add-on plans can be combined into one checkout")
      .optional(),
    forceCheckout: z.boolean().optional(),
    successUrl: returnUrl(),
    cancelUrl: returnUrl().optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.addOnPlanIds) {
      return;
    }

    const allPlanIds = [body.planId, ...body.addOnPlanIds];
    if (new Set(allPlanIds).size !== allPlanIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "addOnPlanIds must not duplicate planId or list the same plan more than once",
        path: ["addOnPlanIds"],
      });
    }
  });

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

export type SubscribeInput = SubscribeBody & {
  customerId: string;
  productInternalId?: string;
};

export interface SubscribeResult {
  invoice?: {
    currency: string;
    hostedUrl: string | null;
    providerInvoiceId: string;
    status: string | null;
    totalAmount: number;
  };
  paymentUrl: string | null;
  requiredAction?: {
    clientSecret?: string;
    paymentIntentId?: string;
    type: string;
  } | null;
}

export interface SubscriptionWithCatalog extends StoredSubscription {
  planId: string;
  planGroup: string;
  planIsDefault: boolean;
  planName: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceInterval: string | null;
  providerProduct: Record<string, string> | null;
}
