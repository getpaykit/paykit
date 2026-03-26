import { APIError } from "better-call";

import type { PayKitContext } from "../core/context";
import { syncCustomerWithDefaults } from "../services/customer-service";

export async function resolveCustomer(
  ctx: PayKitContext,
  request: Request | undefined,
  explicitCustomerId?: string,
): Promise<string> {
  // When called from an HTTP context with identify configured, always resolve
  // the caller's identity. If an explicitCustomerId is also provided, verify
  // it matches — prevents IDOR where a caller passes another user's ID.
  if (ctx.options.client?.identify && request) {
    const identity = await ctx.options.client.identify(request);

    if (explicitCustomerId && explicitCustomerId !== identity.customerId) {
      throw new APIError("FORBIDDEN", {
        message: "customerId does not match authenticated user",
      });
    }

    await syncCustomerWithDefaults(ctx, {
      id: identity.customerId,
      email: identity.email,
      name: identity.name,
    });

    return identity.customerId;
  }

  // Server-to-server: trust the explicit ID (no HTTP request / no identify)
  if (explicitCustomerId) {
    return explicitCustomerId;
  }

  throw new APIError("UNAUTHORIZED", {
    message: "No customerId provided and no identify configured",
  });
}
