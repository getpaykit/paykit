import { definePayKitMethod } from "../api/define-route";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { subscribeToPlan } from "./subscription.service";
import { expireCheckoutSessionBodySchema, subscribeBodySchema } from "./subscription.types";

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
      checkout: ctx.input.checkout,
      forceCheckout: ctx.input.forceCheckout,
      planId: ctx.input.planId,
      quantity: ctx.input.quantity,
      successUrl: ctx.input.successUrl,
      cancelUrl: ctx.input.cancelUrl,
    });
  },
);

/** Expires a provider checkout session after verifying it belongs to the resolved customer. */
export const expireCheckoutSession = definePayKitMethod(
  {
    input: expireCheckoutSessionBodySchema,
    requireCustomer: true,
  },
  async (ctx) => {
    const providerCustomerId = ctx.customer.stripeCustomerId;
    if (!providerCustomerId) {
      throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND);
    }

    const result = await ctx.paykit.provider.expireCheckoutSession({
      providerCheckoutSessionId: ctx.input.checkoutSessionId,
      providerCustomerId,
    });

    return {
      checkoutSessionId: result.providerCheckoutSessionId,
      status: result.status,
    };
  },
);
