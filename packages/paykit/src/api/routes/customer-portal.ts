import * as z from "zod";

import { createPayKitEndpoint } from "../call";
import { resolveCustomer } from "../resolve-customer";

function resolveReturnUrl(request: Request | undefined, explicitReturnUrl?: string): string {
  if (explicitReturnUrl) {
    return explicitReturnUrl;
  }

  if (!request) {
    throw new Error(
      "A returnUrl is required when openCustomerPortal is called without a request context",
    );
  }

  return new URL("/", request.url).toString();
}

export const customerPortal = createPayKitEndpoint(
  "/customer-portal",
  {
    method: "POST",
    body: z.object({
      returnUrl: z.string().url().optional(),
      customerId: z.string().optional(),
    }),
  },
  async (ctx) => {
    const customerId = await resolveCustomer(ctx.context, ctx.request, ctx.body.customerId);

    const providerCustomer = await ctx.context.database.query.providerCustomer.findFirst({
      where: (fields, { and, eq }) =>
        and(eq(fields.customerId, customerId), eq(fields.providerId, ctx.context.provider.id)),
    });

    if (!providerCustomer) {
      throw new Error("Customer not found in provider. Ensure the customer has been synced.");
    }

    const { url } = await ctx.context.stripe.createPortalSession({
      providerCustomerId: providerCustomer.providerCustomerId,
      returnUrl: resolveReturnUrl(ctx.request, ctx.body.returnUrl),
    });

    return { url };
  },
);
