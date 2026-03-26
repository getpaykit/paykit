import type { NormalizedPayment, NormalizedWebhookEvent } from "../types/events";

export interface ProviderPaymentMethod {
  providerMethodId: string;
  type: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface ProviderInvoice {
  currency: string;
  hostedUrl?: string | null;
  periodEndAt?: Date | null;
  periodStartAt?: Date | null;
  providerInvoiceId: string;
  status: string | null;
  totalAmount: number;
}

export interface ProviderRequiredAction {
  clientSecret?: string;
  paymentIntentId?: string;
  type: string;
}

export interface ProviderSubscription {
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

export interface ProviderSubscriptionResult {
  invoice?: ProviderInvoice | null;
  paymentUrl: string | null;
  providerCheckoutSessionId?: string;
  requiredAction?: ProviderRequiredAction | null;
  subscription?: ProviderSubscription | null;
}

export interface StripeRuntime {
  upsertCustomer(data: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ providerCustomerId: string }>;

  attachPaymentMethod(data: {
    providerCustomerId: string;
    returnURL: string;
  }): Promise<{ url: string }>;

  createSubscriptionCheckout(data: {
    providerCustomerId: string;
    providerPriceId: string;
    successUrl: string;
    cancelUrl?: string;
    metadata?: Record<string, string>;
    trialPeriodDays?: number;
  }): Promise<{ paymentUrl: string; providerCheckoutSessionId: string }>;

  createSubscription(data: {
    providerCustomerId: string;
    providerPriceId: string;
    trialPeriodDays?: number;
  }): Promise<ProviderSubscriptionResult>;

  updateSubscription(data: {
    providerPriceId: string;
    providerSubscriptionId: string;
    prorationBehavior?: "always_invoice" | "create_prorations" | "none";
  }): Promise<ProviderSubscriptionResult>;

  createInvoice(data: {
    providerCustomerId: string;
    lines: Array<{ amount: number; description: string }>;
    autoAdvance?: boolean;
  }): Promise<ProviderInvoice>;

  scheduleSubscriptionChange(data: {
    providerPriceId?: string | null;
    providerSubscriptionScheduleId?: string | null;
    providerSubscriptionId: string;
  }): Promise<ProviderSubscriptionResult>;

  cancelSubscription(data: {
    currentPeriodEndAt?: Date | null;
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionResult>;

  resumeSubscription(data: {
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionResult>;

  detachPaymentMethod(data: { providerMethodId: string }): Promise<void>;

  charge(data: {
    amount: number;
    description: string;
    metadata?: Record<string, string>;
    providerCustomerId: string;
    providerMethodId: string;
  }): Promise<NormalizedPayment>;

  syncProduct(data: {
    id: string;
    name: string;
    priceAmount: number;
    priceInterval?: string | null;
    existingProviderProductId?: string | null;
    existingProviderPriceId?: string | null;
  }): Promise<{ providerProductId: string; providerPriceId: string }>;

  handleWebhook(data: {
    body: string;
    headers: Record<string, string>;
  }): Promise<NormalizedWebhookEvent[]>;

  createPortalSession(data: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
}

export interface StripeProviderOptions {
  currency?: string;
  secretKey: string;
  webhookSecret: string;
}

export interface StripeProviderConfig extends StripeProviderOptions {
  id: string;
  kind: "stripe";
  /**
   * Internal test hook so repo tests can stub the Stripe runtime without a network client.
   */
  runtime?: StripeRuntime;
}

export type PayKitProvider = StripeProviderConfig;
