import type { NormalizedWebhookEvent } from "../types/events";

export interface ProviderCustomer {
  frozenTime?: string;
  id: string;
  testClockId?: string;
  syncedEmail?: string | null;
  syncedName?: string | null;
  syncedMetadata?: Record<string, string> | null;
}

export type ProviderCustomerMap = Record<string, ProviderCustomer>;

export interface ProviderTestClock {
  frozenTime: Date;
  id: string;
  name?: string | null;
  status: string;
}

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

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;

  createCustomer(data: {
    createTestClock?: boolean;
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ providerCustomer: ProviderCustomer }>;

  updateCustomer(data: {
    providerCustomerId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<void>;

  deleteCustomer(data: { providerCustomerId: string }): Promise<void>;

  getTestClock(data: { testClockId: string }): Promise<ProviderTestClock>;

  advanceTestClock(data: { testClockId: string; frozenTime: Date }): Promise<ProviderTestClock>;

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
  }): Promise<{ paymentUrl: string; providerCheckoutSessionId: string }>;

  createSubscription(data: {
    providerCustomerId: string;
    providerPriceId: string;
  }): Promise<ProviderSubscriptionResult>;

  updateSubscription(data: {
    providerPriceId: string;
    providerSubscriptionId: string;
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

  listActiveSubscriptions(data: {
    providerCustomerId: string;
  }): Promise<Array<{ providerSubscriptionId: string }>>;

  resumeSubscription(data: {
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionResult>;

  detachPaymentMethod(data: { providerMethodId: string }): Promise<void>;

  archiveProduct(data: { providerProductId: string }): Promise<void>;

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

  check?(): Promise<{
    ok: boolean;
    displayName: string;
    mode: string;
    webhookEndpoints?: Array<{ url: string; status: string }>;
    error?: string;
  }>;
}

export interface PayKitProviderConfig {
  id: string;
  name: string;
  createAdapter(): PaymentProvider;
}
