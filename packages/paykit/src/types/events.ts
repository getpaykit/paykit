export interface NormalizedPaymentMethod {
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
  last4?: string;
  providerMethodId: string;
  type: string;
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

export interface PayKitEventError {
  code?: string;
  message: string;
}

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

type EventByName<TEventMap extends object, TName extends keyof TEventMap> = {
  name: TName;
  payload: TEventMap[TName];
};

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
  "payment.failed": {
    error: PayKitEventError;
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

// User-facing event system — events will be added as billing services are built.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PayKitEventMap {}

export type PayKitEventName = keyof PayKitEventMap;

export type PayKitEventHandlers = {
  [TName in PayKitEventName]?: (event: {
    name: TName;
    payload: PayKitEventMap[TName];
  }) => Promise<void> | void;
} & {
  "*"?: (input: {
    event: { name: PayKitEventName; payload: PayKitEventMap[PayKitEventName] };
  }) => Promise<void> | void;
};
