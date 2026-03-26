import * as z from "zod";

import { subscribeToPlan } from "../../services/subscribe-service";
import { createPayKitEndpoint } from "../call";
import { resolveCustomer } from "../resolve-customer";

function resolveSuccessUrl(request: Request | undefined, explicitSuccessUrl?: string): string {
  if (explicitSuccessUrl) {
    return explicitSuccessUrl;
  }

  if (!request) {
    throw new Error("A successUrl is required when subscribe is called without a request context");
  }

  return new URL("/", request.url).toString();
}

export const subscribe = createPayKitEndpoint(
  "/subscribe",
  {
    method: "POST",
    body: z.object({
      planId: z.string(),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
      customerId: z.string().optional(),
      redirectMode: z.enum(["always", "if_required", "never"]).optional(),
      prorationBehavior: z.enum(["always_invoice", "none"]).optional(),
    }),
  },
  async (ctx) => {
    const customerId = await resolveCustomer(ctx.context, ctx.request, ctx.body.customerId);
    return subscribeToPlan(ctx.context, {
      cancelUrl: ctx.body.cancelUrl,
      customerId,
      planId: ctx.body.planId,
      prorationBehavior: ctx.body.prorationBehavior,
      redirectMode: ctx.body.redirectMode ?? "if_required",
      successUrl: resolveSuccessUrl(ctx.request, ctx.body.successUrl),
    });
  },
);
