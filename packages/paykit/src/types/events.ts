import type { Customer, Payment, PaymentMethod, Refund } from "./models";

export interface UpsertCustomerAction {
  type: "customer.upsert";
  data: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  };
}

export interface DeleteCustomerAction {
  type: "customer.delete";
  data: {
    id: string;
  };
}

export interface NormalizedPaymentMethod {
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
  last4?: string;
  providerMethodId: string;
  type: string;
}

export interface UpsertPaymentMethodAction {
  type: "payment_method.upsert";
  data: {
    paymentMethod: NormalizedPaymentMethod;
    providerCustomerId: string;
  };
}

export interface DeletePaymentMethodAction {
  type: "payment_method.delete";
  data: {
    providerMethodId: string;
  };
}

export interface NormalizedPayment {
  amount: number;
  createdAt: Date;
  currency: string;
  description?: string | null;
  metadata?: Record<string, string>;
  providerMethodId?: string | null;
  providerPaymentId: string;
  status: string;
}

export interface UpsertPaymentAction {
  type: "payment.upsert";
  data: {
    payment: NormalizedPayment;
    providerCustomerId: string;
  };
}

export type WebhookApplyAction =
  | UpsertCustomerAction
  | DeleteCustomerAction
  | UpsertPaymentMethodAction
  | DeletePaymentMethodAction
  | UpsertPaymentAction;

export interface PayKitEventError {
  code?: string;
  message: string;
}

export interface PayKitEventMap {
  "payment.failed": {
    customer: Customer;
    error: PayKitEventError;
    payment: Payment;
  };
  "payment.refunded": {
    customer: Customer;
    payment: Payment;
    refund: Refund;
  };
  "payment.succeeded": {
    customer: Customer;
    payment: Payment;
  };
  "checkout.completed": {
    checkoutSessionId: string;
    customer: Customer;
    paymentStatus: string | null;
    providerId: string;
    status: string | null;
  };
  "payment_method.attached": {
    customer: Customer;
    paymentMethod: PaymentMethod;
  };
  "payment_method.detached": {
    customer: Customer;
    paymentMethod: PaymentMethod;
  };
}

export type PayKitEventName = keyof PayKitEventMap;

type EventByName<TEventMap extends object, TName extends keyof TEventMap> = {
  name: TName;
  payload: TEventMap[TName];
};

export type AnyPayKitEvent = {
  [TName in PayKitEventName]: EventByName<PayKitEventMap, TName>;
}[PayKitEventName];

export type PayKitEvent<TName extends PayKitEventName = PayKitEventName> = Extract<
  AnyPayKitEvent,
  { name: TName }
>;

export type PayKitEventPayload<TName extends PayKitEventName> = PayKitEventMap[TName];

export interface NormalizedWebhookEventMap {
  "checkout.completed": {
    checkoutSessionId: string;
    paymentStatus: string | null;
    providerCustomerId: string;
    providerEventId?: string;
    status: string | null;
  };
  "payment_method.attached": {
    paymentMethod: NormalizedPaymentMethod;
    providerCustomerId: string;
  };
  "payment.succeeded": {
    payment: NormalizedPayment;
    providerCustomerId: string;
  };
  "payment_method.detached": {
    providerMethodId: string;
  };
}

export type NormalizedWebhookEventName = keyof NormalizedWebhookEventMap;

export type AnyNormalizedWebhookEvent = {
  [TName in NormalizedWebhookEventName]: EventByName<NormalizedWebhookEventMap, TName> & {
    actions?: WebhookApplyAction[];
  };
}[NormalizedWebhookEventName];

export type NormalizedWebhookEvent<
  TName extends NormalizedWebhookEventName = NormalizedWebhookEventName,
> = Extract<AnyNormalizedWebhookEvent, { name: TName }>;

export type PayKitNamedEventHandler<TName extends PayKitEventName> = (
  event: PayKitEvent<TName>,
) => Promise<void> | void;

export interface PayKitCatchAllEvent<TEvent extends AnyPayKitEvent = AnyPayKitEvent> {
  event: TEvent;
}

export type PayKitCatchAllEventHandler = (input: PayKitCatchAllEvent) => Promise<void> | void;

export type PayKitEventHandlers = {
  [TName in PayKitEventName]?: PayKitNamedEventHandler<TName>;
} & {
  "*"?: PayKitCatchAllEventHandler;
};
