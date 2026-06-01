import { and, eq, sql } from "drizzle-orm";

import type { PayKitContext } from "../core/context";
import { getTraceId } from "../core/logger";
import { generateId } from "../core/utils";
import { emitCustomerUpdated } from "../customer/customer.service";
import { webhookEvent } from "../database/schema";
import { applyInvoiceWebhookAction } from "../invoice/invoice.service";
import { applyPaymentMethodWebhookAction } from "../payment-method/payment-method.service";
import { applyPaymentWebhookAction } from "../payment/payment.service";
import {
  handleSubscribeCheckoutCompleted,
  applySubscriptionWebhookAction,
  prepareSubscribeCheckoutCompleted,
} from "../subscription/subscription.service";
import type { AnyNormalizedWebhookEvent, WebhookApplyAction } from "../types/events";

export interface HandleWebhookInput {
  allowStaleSignatures?: boolean;
  body: string;
  headers: Record<string, string>;
}

async function beginWebhookEvent(
  ctx: PayKitContext,
  input: {
    payload: Record<string, unknown>;
    providerEventId: string;
    type: string;
  },
): Promise<boolean> {
  try {
    await ctx.database.insert(webhookEvent).values({
      error: null,
      id: generateId("evt"),
      payload: input.payload,
      processedAt: null,
      providerEventId: input.providerEventId,
      providerId: ctx.provider.id,
      receivedAt: new Date(),
      status: "processing",
      traceId: getTraceId(),
      type: input.type,
    });
    return true;
  } catch (error: unknown) {
    const code =
      (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    if (code !== "23505") {
      throw error;
    }

    const retried = await ctx.database
      .update(webhookEvent)
      .set({ error: null, processedAt: null, status: "processing" })
      .where(
        and(
          eq(webhookEvent.providerId, ctx.provider.id),
          eq(webhookEvent.providerEventId, input.providerEventId),
          sql`(${webhookEvent.status} = 'failed' OR (${webhookEvent.status} = 'processing' AND ${webhookEvent.receivedAt} < now() - interval '5 minutes'))`,
        ),
      )
      .returning({ id: webhookEvent.id });

    return retried.length > 0;
  }
}

async function finishWebhookEvent(
  ctx: PayKitContext,
  input: {
    error?: string;
    providerEventId: string;
    status: "failed" | "processed";
  },
): Promise<void> {
  await ctx.database
    .update(webhookEvent)
    .set({
      error: input.error ?? null,
      processedAt: new Date(),
      status: input.status,
    })
    .where(
      and(
        eq(webhookEvent.providerId, ctx.provider.id),
        eq(webhookEvent.providerEventId, input.providerEventId),
      ),
    );
}

function getProviderEventId(
  event: AnyNormalizedWebhookEvent,
  index: number,
  parentEventId: string | null,
): string {
  const payload = event.payload as Record<string, unknown>;
  const providerEventId = payload.providerEventId;
  if (typeof providerEventId === "string" && providerEventId.length > 0) {
    return providerEventId;
  }
  // Synthetic sub-events (e.g. from checkout expansion) include the parent's
  // provider event ID to avoid collisions across different webhook deliveries.
  const prefix = parentEventId ?? "unknown";
  return `${prefix}:${event.name}:${index}`;
}

function getParentProviderEventId(events: readonly AnyNormalizedWebhookEvent[]): string | null {
  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.providerEventId === "string" && payload.providerEventId.length > 0) {
      return payload.providerEventId;
    }
  }

  return null;
}

async function applyAction(ctx: PayKitContext, action: WebhookApplyAction): Promise<string | null> {
  switch (action.type) {
    case "payment_method.upsert":
    case "payment_method.delete":
      return applyPaymentMethodWebhookAction(ctx, action);
    case "payment.upsert":
      return applyPaymentWebhookAction(ctx, action);
    case "subscription.upsert":
    case "subscription.delete":
      return applySubscriptionWebhookAction(ctx, action);
    case "invoice.upsert":
      return applyInvoiceWebhookAction(ctx, action);
  }
}

function getWebhookApplyActions(event: AnyNormalizedWebhookEvent): WebhookApplyAction[] {
  switch (event.name) {
    case "checkout.completed": {
      return [];
    }
    case "payment_method.attached": {
      return [
        {
          data: {
            paymentMethod: event.payload.paymentMethod,
            providerCustomerId: event.payload.providerCustomerId,
          },
          type: "payment_method.upsert",
        },
      ];
    }
    case "payment_method.detached": {
      return [
        {
          data: {
            providerMethodId: event.payload.providerMethodId,
          },
          type: "payment_method.delete",
        },
      ];
    }
    case "payment.succeeded": {
      return [
        {
          data: {
            payment: event.payload.payment,
            providerCustomerId: event.payload.providerCustomerId,
          },
          type: "payment.upsert",
        },
      ];
    }
    case "subscription.updated": {
      return [
        {
          data: {
            providerCustomerId: event.payload.providerCustomerId,
            subscription: event.payload.subscription,
          },
          type: "subscription.upsert",
        },
      ];
    }
    case "subscription.deleted": {
      return [
        {
          data: {
            providerCustomerId: event.payload.providerCustomerId,
            providerSubscriptionId: event.payload.providerSubscriptionId,
          },
          type: "subscription.delete",
        },
      ];
    }
    case "invoice.updated": {
      return [
        {
          data: {
            invoice: event.payload.invoice,
            providerCustomerId: event.payload.providerCustomerId,
            providerSubscriptionId: event.payload.providerSubscriptionId,
          },
          type: "invoice.upsert",
        },
      ];
    }
  }
}

async function processWebhookEvent(
  ctx: PayKitContext,
  event: AnyNormalizedWebhookEvent,
  providerEventId: string,
): Promise<void> {
  // Record the webhook outside the business transaction so failures are preserved.
  const shouldProcess = await beginWebhookEvent(ctx, {
    payload: event.payload as Record<string, unknown>,
    providerEventId,
    type: event.name,
  });
  if (!shouldProcess) {
    ctx.logger.info({ event: event.name, providerEventId }, "webhook skipped (duplicate)");
    return;
  }

  try {
    // Provider calls must happen before the DB transaction opens.
    const checkoutCompletion =
      event.name === "checkout.completed"
        ? await prepareSubscribeCheckoutCompleted(ctx, event)
        : null;

    const customerIds = await ctx.database.transaction(async (tx) => {
      const txCtx = { ...ctx, database: tx } as PayKitContext;
      const ids = new Set<string>();

      if (checkoutCompletion) {
        const customerId = await handleSubscribeCheckoutCompleted(txCtx, checkoutCompletion);
        if (customerId) {
          ids.add(customerId);
        }
      }

      for (const action of getWebhookApplyActions(event)) {
        ctx.logger.info({ actionType: action.type }, "applying action");
        const customerId = await applyAction(txCtx, action);
        if (customerId) {
          ids.add(customerId);
        }
      }

      return ids;
    });

    for (const customerId of customerIds) {
      await emitCustomerUpdated(ctx, customerId);
    }

    ctx.logger.info({ event: event.name }, "webhook processed");

    await finishWebhookEvent(ctx, {
      providerEventId,
      status: "processed",
    });
  } catch (error) {
    const errorDetail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    ctx.logger.error({ event: event.name, err: error }, "webhook failed");

    await finishWebhookEvent(ctx, {
      error: errorDetail,
      providerEventId,
      status: "failed",
    });
    throw error;
  }
}

export async function handleWebhook(
  ctx: PayKitContext,
  input: HandleWebhookInput,
): Promise<{ received: true }> {
  return ctx.logger.trace.run("wh", async () => {
    const events = await ctx.provider.parseWebhook({
      allowStaleSignatures: input.allowStaleSignatures,
      body: input.body,
      headers: input.headers,
    });
    const parentEventId = getParentProviderEventId(events);

    for (const [index, event] of events.entries()) {
      const providerEventId = getProviderEventId(event, index, parentEventId);
      ctx.logger.info({ event: event.name, providerEventId }, "webhook received");
      await processWebhookEvent(ctx, event, providerEventId);
    }

    return { received: true };
  });
}
