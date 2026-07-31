import * as z from "zod";

import { returnUrl } from "../api/define-route";
import type { StoredSubscription } from "../types/models";

export const subscribeBodySchema = z.object({
  planId: z.string(),
  /** Additional plan IDs to combine with `planId` into one checkout (e.g. add-ons). */
  addOnPlanIds: z.array(z.string()).optional(),
  forceCheckout: z.boolean().optional(),
  successUrl: returnUrl(),
  cancelUrl: returnUrl().optional(),
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
