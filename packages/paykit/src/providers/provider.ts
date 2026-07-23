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

export interface ProviderTunnelAccount {
  displayName?: string;
  environment: string;
  providerAccountId: string;
  providerId: string;
}

export interface ProviderTunnelWebhook {
  created: boolean;
  endpointId: string;
  webhookSecret?: string;
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
  providerSubscriptionId: string;
  providerSubscriptionScheduleId?: string | null;
  quantity?: number;
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
    providerProduct: Record<string, string>;
    successUrl: string;
    cancelUrl?: string;
    metadata?: Record<string, string>;
    quantity: number;
  }): Promise<{ paymentUrl: string; providerCheckoutSessionId: string }>;

  createSubscription(data: {
    providerCustomerId: string;
    providerProduct: Record<string, string>;
    quantity: number;
  }): Promise<ProviderSubscriptionResult>;

  updateSubscription(data: {
    providerProduct: Record<string, string>;
    providerSubscriptionId: string;
    quantity: number;
  }): Promise<ProviderSubscriptionResult>;

  createInvoice(data: {
    providerCustomerId: string;
    lines: Array<{ amount: number; description: string }>;
    autoAdvance?: boolean;
  }): Promise<ProviderInvoice>;

  scheduleSubscriptionChange(data: {
    providerProduct?: Record<string, string> | null;
    providerSubscriptionScheduleId?: string | null;
    providerSubscriptionId: string;
    quantity: number;
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

  syncProducts(data: {
    products: Array<{
      id: string;
      name: string;
      priceAmount: number;
      priceCurrency: string;
      priceInterval?: string | null;
      existingProviderProduct?: Record<string, string> | null;
    }>;
  }): Promise<{
    results: Array<{
      id: string;
      providerProduct: Record<string, string>;
    }>;
  }>;

  handleWebhook(data: {
    allowUnsignedPayload?: boolean;
    body: string;
    headers: Record<string, string>;
  }): Promise<NormalizedWebhookEvent[]>;

  createPortalSession(data: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  getTunnelAccount?(): Promise<ProviderTunnelAccount>;

  ensureTunnelWebhook?(data: {
    existingEndpointId?: string | null;
    url: string;
  }): Promise<ProviderTunnelWebhook>;

  disableTunnelWebhook?(data: { endpointId: string }): Promise<void>;

  check?(): Promise<{
    ok: boolean;
    displayName: string;
    mode: string;
    webhookEndpoints?: Array<{ url: string; status: string }>;
    errors?: string[];
    customerSample?: Array<{ providerEmail: string; paykitCustomerId: string | null }>;
    error?: string;
  }>;
}
