import type { PayKitContext } from "../core/context";
import { PayKitError } from "../core/errors";
import {
  deleteCustomerById,
  getCustomerById,
  getProviderCustomerByProviderCustomerId,
  syncCustomer,
} from "../services/customer-service";
import {
  deletePaymentMethodFromWebhook,
  getPaymentMethodByProviderMethodId,
  toPublicPaymentMethod,
  upsertPaymentMethodFromWebhook,
} from "../services/payment-method-service";
import {
  getPaymentByProviderPaymentId,
  toPublicPayment,
  upsertPaymentFromWebhook,
} from "../services/payment-service";
import type {
  AnyPayKitEvent,
  NormalizedWebhookEvent,
  PayKitEvent,
  PayKitNamedEventHandler,
  WebhookApplyAction,
} from "../types/events";

export interface HandleWebhookInput {
  providerId: string;
  body: string;
  headers: Record<string, string>;
}

async function applyAction(
  ctx: PayKitContext,
  providerId: string,
  action: WebhookApplyAction,
): Promise<void> {
  if (action.type === "customer.upsert") {
    await syncCustomer(ctx.database, action.data);
    return;
  }

  if (action.type === "customer.delete") {
    await deleteCustomerById(ctx.database, action.data.id);
    return;
  }

  if (action.type === "payment_method.upsert") {
    await upsertPaymentMethodFromWebhook(ctx, {
      paymentMethod: action.data.paymentMethod,
      providerCustomerId: action.data.providerCustomerId,
      providerId,
    });
    return;
  }

  if (action.type === "payment_method.delete") {
    await deletePaymentMethodFromWebhook(ctx, {
      providerId,
      providerMethodId: action.data.providerMethodId,
    });
    return;
  }

  if (action.type === "payment.upsert") {
    await upsertPaymentFromWebhook(ctx, {
      payment: action.data.payment,
      providerCustomerId: action.data.providerCustomerId,
      providerId,
    });
    return;
  }

  const exhaustiveAction: never = action;
  throw new Error(`Unhandled webhook action: ${JSON.stringify(exhaustiveAction)}`);
}

async function toPublicEvent(
  ctx: PayKitContext,
  providerId: string,
  event: NormalizedWebhookEvent,
): Promise<AnyPayKitEvent | null> {
  if (event.name === "checkout.completed") {
    const providerCustomer = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: event.payload.providerCustomerId,
      providerId,
    });
    if (!providerCustomer) {
      throw new PayKitError("PROVIDER_CUSTOMER_NOT_FOUND");
    }

    const customer = await getCustomerById(ctx.database, providerCustomer.customerId);
    if (!customer) {
      throw new PayKitError("CUSTOMER_NOT_FOUND");
    }

    const publicEvent: PayKitEvent<"checkout.completed"> = {
      name: "checkout.completed",
      payload: {
        checkoutSessionId: event.payload.checkoutSessionId,
        customer,
        paymentStatus: event.payload.paymentStatus,
        providerId,
        status: event.payload.status,
      },
    };
    return publicEvent;
  }

  if (event.name === "payment_method.attached") {
    const providerCustomer = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: event.payload.providerCustomerId,
      providerId,
    });
    if (!providerCustomer) {
      throw new PayKitError("PROVIDER_CUSTOMER_NOT_FOUND");
    }

    const customer = await getCustomerById(ctx.database, providerCustomer.customerId);
    if (!customer) {
      throw new PayKitError("CUSTOMER_NOT_FOUND");
    }

    const paymentMethod = await getPaymentMethodByProviderMethodId(ctx, {
      providerId,
      providerMethodId: event.payload.paymentMethod.providerMethodId,
    });
    if (!paymentMethod) {
      throw new PayKitError("PAYMENT_METHOD_NOT_FOUND");
    }

    const publicEvent: PayKitEvent<"payment_method.attached"> = {
      name: "payment_method.attached",
      payload: {
        customer,
        paymentMethod: toPublicPaymentMethod(paymentMethod),
      },
    };
    return publicEvent;
  }

  if (event.name === "payment_method.detached") {
    const paymentMethod = await getPaymentMethodByProviderMethodId(ctx, {
      includeDeleted: true,
      providerId,
      providerMethodId: event.payload.providerMethodId,
    });
    if (!paymentMethod) {
      ctx.logger.warn("Ignoring detached payment method without local state", {
        providerId,
        providerMethodId: event.payload.providerMethodId,
      });
      return null;
    }

    const customer = await getCustomerById(ctx.database, paymentMethod.customerId);
    if (!customer) {
      throw new PayKitError("CUSTOMER_NOT_FOUND");
    }

    const publicEvent: PayKitEvent<"payment_method.detached"> = {
      name: "payment_method.detached",
      payload: {
        customer,
        paymentMethod: toPublicPaymentMethod(paymentMethod),
      },
    };
    return publicEvent;
  }

  if (event.name === "payment.succeeded") {
    const providerCustomer = await getProviderCustomerByProviderCustomerId(ctx.database, {
      providerCustomerId: event.payload.providerCustomerId,
      providerId,
    });
    if (!providerCustomer) {
      throw new PayKitError("PROVIDER_CUSTOMER_NOT_FOUND");
    }

    const customer = await getCustomerById(ctx.database, providerCustomer.customerId);
    if (!customer) {
      throw new PayKitError("CUSTOMER_NOT_FOUND");
    }

    const payment = await getPaymentByProviderPaymentId(ctx, {
      providerId,
      providerPaymentId: event.payload.payment.providerPaymentId,
    });
    if (!payment) {
      throw new PayKitError("PAYMENT_NOT_FOUND");
    }

    const publicEvent: PayKitEvent<"payment.succeeded"> = {
      name: "payment.succeeded",
      payload: {
        customer,
        payment: toPublicPayment(payment),
      },
    };
    return publicEvent;
  }

  const exhaustiveEvent: never = event;
  throw new Error(`Unhandled normalized event: ${JSON.stringify(exhaustiveEvent)}`);
}

async function emitEvent(ctx: PayKitContext, event: AnyPayKitEvent): Promise<void> {
  const named = ctx.eventHandlers[event.name] as
    | PayKitNamedEventHandler<typeof event.name>
    | undefined;
  if (named) {
    await named(event);
  }

  const catchAll = ctx.eventHandlers["*"];
  if (catchAll) {
    await catchAll({ event });
  }
}

export async function handleWebhook(
  ctx: PayKitContext,
  input: HandleWebhookInput,
): Promise<{ received: true }> {
  const provider = ctx.providers.get(input.providerId);
  if (!provider) {
    throw new PayKitError("INVALID_WEBHOOK_PROVIDER");
  }

  const events = await provider.handleWebhook({
    body: input.body,
    headers: input.headers,
  });

  for (const event of events) {
    if (event.actions) {
      for (const action of event.actions) {
        await applyAction(ctx, input.providerId, action);
      }
    }

    const publicEvent = await toPublicEvent(ctx, input.providerId, event);
    if (publicEvent) {
      await emitEvent(ctx, publicEvent);
    }
  }

  return { received: true };
}
