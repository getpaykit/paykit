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

export interface NormalizedSubscription {
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  currentPeriodEndAt?: Date | null;
  currentPeriodStartAt?: Date | null;
  endedAt?: Date | null;
  providerPriceId?: string | null;
  providerSubscriptionId: string;
  providerSubscriptionScheduleId?: string | null;
  status: string;
}

export interface NormalizedInvoice {
  currency: string;
  hostedUrl?: string | null;
  periodEndAt?: Date | null;
  periodStartAt?: Date | null;
  providerInvoiceId: string;
  status: string | null;
  totalAmount: number;
}

export interface CheckoutCompletedSubscription extends NormalizedSubscription {}
export interface CheckoutCompletedInvoice extends NormalizedInvoice {}

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

export interface UpsertSubscriptionAction {
  type: "subscription.upsert";
  data: {
    providerCustomerId: string;
    subscription: NormalizedSubscription;
  };
}

export interface DeleteSubscriptionAction {
  type: "subscription.delete";
  data: {
    providerCustomerId: string;
    providerSubscriptionId: string;
  };
}

export interface UpsertInvoiceAction {
  type: "invoice.upsert";
  data: {
    invoice: NormalizedInvoice;
    providerCustomerId: string;
    providerSubscriptionId?: string | null;
  };
}

export type WebhookApplyAction =
  | UpsertCustomerAction
  | DeleteCustomerAction
  | UpsertPaymentMethodAction
  | DeletePaymentMethodAction
  | UpsertPaymentAction
  | UpsertSubscriptionAction
  | DeleteSubscriptionAction
  | UpsertInvoiceAction;

type EventByName<TEventMap extends object, TName extends keyof TEventMap> = {
  name: TName;
  payload: TEventMap[TName];
};

export interface NormalizedWebhookEventMap {
  "checkout.completed": {
    checkoutSessionId: string;
    invoice?: CheckoutCompletedInvoice;
    metadata?: Record<string, string>;
    mode?: "payment" | "setup" | "subscription";
    providerInvoiceId?: string;
    providerSubscriptionId?: string;
    paymentStatus: string | null;
    providerCustomerId: string;
    providerEventId?: string;
    status: string | null;
    subscription?: CheckoutCompletedSubscription;
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
  "subscription.updated": {
    providerCustomerId: string;
    subscription: NormalizedSubscription;
  };
  "subscription.deleted": {
    providerCustomerId: string;
    providerSubscriptionId: string;
  };
  "invoice.updated": {
    invoice: NormalizedInvoice;
    providerCustomerId: string;
    providerSubscriptionId?: string | null;
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

export interface PayKitEventMap {
  "customer.updated": {
    customerId: string;
    plans: readonly {
      currentPeriodEndAt: Date | null;
      endedAt: Date | null;
      id: string;
      startedAt: Date | null;
      status: string;
    }[];
  };
}

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
