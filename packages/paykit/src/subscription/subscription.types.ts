import * as z from "zod";

import { returnUrl } from "../api/define-route";
import type { StoredSubscription } from "../types/models";

const checkoutIdempotencyKeySchema = z.string().min(1).max(255);
const checkoutCustomerUpdateValueSchema = z.enum(["auto", "never"]);

export const subscriptionCheckoutOptionsSchema = z.object({
  allowPromotionCodes: z.boolean().optional(),
  automaticTax: z
    .object({
      enabled: z.boolean(),
    })
    .optional(),
  billingAddressCollection: z.enum(["auto", "required"]).optional(),
  customerUpdate: z
    .object({
      address: checkoutCustomerUpdateValueSchema.optional(),
      name: checkoutCustomerUpdateValueSchema.optional(),
      shipping: checkoutCustomerUpdateValueSchema.optional(),
    })
    .optional(),
  idempotencyKey: checkoutIdempotencyKeySchema.optional(),
  taxIdCollection: z
    .object({
      enabled: z.boolean(),
      required: z.enum(["never", "if_supported"]).optional(),
    })
    .optional(),
});

export const subscribeBodySchema = z.object({
  planId: z.string(),
  checkout: subscriptionCheckoutOptionsSchema.optional(),
  forceCheckout: z.boolean().optional(),
  quantity: z.number().int().positive().optional(),
  successUrl: returnUrl(),
  cancelUrl: returnUrl().optional(),
});

export const expireCheckoutSessionBodySchema = z.object({
  checkoutSessionId: z.string().min(1),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type SubscriptionCheckoutOptions = z.infer<typeof subscriptionCheckoutOptionsSchema>;

export type SubscribeInput = SubscribeBody & {
  customerId: string;
  productInternalId?: string;
};

export type ExpireCheckoutSessionInput = z.infer<typeof expireCheckoutSessionBodySchema> & {
  customerId: string;
};

export interface ExpireCheckoutSessionResult {
  checkoutSessionId: string;
  status: "expired";
}

export interface SubscribeResult {
  checkoutSessionId?: string;
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
