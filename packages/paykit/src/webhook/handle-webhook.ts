import type { PayKitContext } from "../core/context";
import { deleteCustomerById, syncCustomer } from "../services/customer-service";
import type { WebhookApplyAction } from "../types/events";

export interface HandleWebhookInput {
  body: string;
  headers: Record<string, string>;
}

async function applyAction(ctx: PayKitContext, action: WebhookApplyAction): Promise<void> {
  if (action.type === "customer.upsert") {
    await syncCustomer(ctx.database, action.data);
    return;
  }

  if (action.type === "customer.delete") {
    await deleteCustomerById(ctx.database, action.data.id);
    return;
  }

  // payment_method.upsert, payment_method.delete, payment.upsert
  // These actions are received from the provider but not yet handled
  // in the new billing model. They will be wired up when billing
  // services are implemented.
  ctx.logger.debug("Unhandled webhook action type", { type: action.type });
}

export async function handleWebhook(
  ctx: PayKitContext,
  input: HandleWebhookInput,
): Promise<{ received: true }> {
  const events = await ctx.provider.handleWebhook({
    body: input.body,
    headers: input.headers,
  });

  for (const event of events) {
    if (event.actions) {
      for (const action of event.actions) {
        await applyAction(ctx, action);
      }
    }
  }

  return { received: true };
}
