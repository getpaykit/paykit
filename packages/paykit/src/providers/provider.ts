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

export interface PayKitProviderCapabilities {
  /**
   * Provider-hosted subscription products/prices can be created or updated.
   * Requires {@link PayKitProvider.upsertSubscriptionProduct}.
   * May also provide {@link PayKitProvider.cleanupSubscriptionProducts}.
   */
  subscriptionProducts: boolean;
  /**
   * Provider can create hosted checkout sessions for subscriptions.
   * Requires {@link PayKitProvider.createSubscriptionCheckout}.
   */
  subscriptionCheckout: boolean;
  /**
   * Provider can open a customer self-service billing portal.
   * Requires {@link PayKitProvider.createCustomerPortalSession}.
   */
  customerPortal: boolean;
  /**
   * Provider can create one-off invoices through its API.
   * Requires {@link PayKitProvider.createInvoice}.
   */
  createInvoices: boolean;
  /**
   * Provider can detach reusable payment methods.
   * Requires {@link PayKitProvider.detachPaymentMethod}.
   */
  detachPaymentMethods: boolean;
  /**
   * Provider can collect reusable payment methods without creating a subscription.
   * Requires {@link PayKitProvider.createPaymentMethodSetupSession}.
   */
  setupPaymentMethods: boolean;
  /**
   * Provider can mark a subscription to cancel at the current period end.
   * Requires {@link PayKitProvider.cancelSubscriptionAtPeriodEnd}.
   */
  cancelSubscriptionsAtPeriodEnd: boolean;
  /**
   * Provider can create a subscription directly without hosted checkout.
   * Requires {@link PayKitProvider.createSubscription}.
   */
  createSubscriptions: boolean;
  /**
   * Provider can change a subscription product immediately.
   * Requires {@link PayKitProvider.changeSubscriptionProduct}.
   */
  changeSubscriptionProducts: boolean;
  /**
   * Provider can list active subscriptions for a customer.
   * Requires {@link PayKitProvider.listActiveSubscriptions}.
   */
  listActiveSubscriptions: boolean;
  /**
   * Provider can schedule a product change at period end without explicit schedule resources.
   * Requires {@link PayKitProvider.changeSubscriptionProductAtPeriodEnd}.
   */
  pendingSubscriptionProductChanges: boolean;
  /**
   * Provider can clear a pending cancel-at-period-end state.
   * Requires {@link PayKitProvider.resumeSubscriptionAtPeriodEnd}.
   */
  resumeSubscriptionsAtPeriodEnd: boolean;
  /**
   * Provider has explicit subscription schedule resources.
   * Requires {@link PayKitProvider.getOrCreateSubscriptionSchedule} and
   * {@link PayKitProvider.updateSubscriptionSchedulePhases}.
   */
  subscriptionSchedules: boolean;
  /**
   * Provider supports deterministic test clocks.
   * Requires {@link PayKitProvider.getTestClock} and {@link PayKitProvider.advanceTestClock}.
   */
  testClocks: boolean;
  /**
   * Provider webhook endpoints can be managed through its API.
   * Requires {@link PayKitProvider.getWebhookEndpointAccount},
   * {@link PayKitProvider.ensureWebhookEndpoint}, and {@link PayKitProvider.deleteWebhookEndpoint}.
   */
  manageWebhookEndpoints: boolean;
}

export interface ProviderWebhookEndpointAccount {
  displayName?: string;
  environment: string;
  providerAccountId: string;
  providerId: string;
}

export interface ProviderWebhookEndpointResult {
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
  /** Current provider product/price reference when the provider exposes it. */
  providerProduct?: Record<string, string> | null;
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

export interface ProviderProductInput {
  existingProviderProduct?: Record<string, string> | null;
  id: string;
  name: string;
  priceAmount: number;
  priceInterval?: string | null;
}

export interface ProviderProductResult {
  /** Provider-specific product/price reference stored by PayKit. */
  providerProduct: Record<string, string>;
}

export interface ProviderSubscriptionSchedulePhase {
  endAt?: Date | null;
  providerProduct: Record<string, string>;
  startAt: Date;
}

export interface ProviderSubscriptionSchedule {
  /** Start of the currently active provider schedule phase. */
  currentPhaseStartAt: Date;
  id: string;
}

export interface ProviderHealthResult {
  ok: boolean;
  displayName: string;
  mode: string;
  webhookEndpoints?: Array<{ url: string; status: string }>;
  errors?: string[];
  customerSample?: Array<{ providerEmail: string; paykitCustomerId: string | null }>;
  error?: string;
}

type CapabilityMethodKeys =
  | "advanceTestClock"
  | "cancelSubscriptionAtPeriodEnd"
  | "changeSubscriptionProduct"
  | "changeSubscriptionProductAtPeriodEnd"
  | "cleanupSubscriptionProducts"
  | "createCustomerPortalSession"
  | "createInvoice"
  | "createPaymentMethodSetupSession"
  | "createSubscription"
  | "createSubscriptionCheckout"
  | "deleteWebhookEndpoint"
  | "detachPaymentMethod"
  | "ensureWebhookEndpoint"
  | "getOrCreateSubscriptionSchedule"
  | "getTestClock"
  | "getWebhookEndpointAccount"
  | "listActiveSubscriptions"
  | "resumeSubscriptionAtPeriodEnd"
  | "updateSubscriptionSchedulePhases"
  | "upsertSubscriptionProduct";

type CapabilityRequiredMethodKeys<TCapabilities extends PayKitProviderCapabilities> =
  | (TCapabilities["subscriptionProducts"] extends true ? "upsertSubscriptionProduct" : never)
  | (TCapabilities["subscriptionCheckout"] extends true ? "createSubscriptionCheckout" : never)
  | (TCapabilities["customerPortal"] extends true ? "createCustomerPortalSession" : never)
  | (TCapabilities["createInvoices"] extends true ? "createInvoice" : never)
  | (TCapabilities["detachPaymentMethods"] extends true ? "detachPaymentMethod" : never)
  | (TCapabilities["setupPaymentMethods"] extends true ? "createPaymentMethodSetupSession" : never)
  | (TCapabilities["cancelSubscriptionsAtPeriodEnd"] extends true
      ? "cancelSubscriptionAtPeriodEnd"
      : never)
  | (TCapabilities["createSubscriptions"] extends true ? "createSubscription" : never)
  | (TCapabilities["changeSubscriptionProducts"] extends true ? "changeSubscriptionProduct" : never)
  | (TCapabilities["listActiveSubscriptions"] extends true ? "listActiveSubscriptions" : never)
  | (TCapabilities["pendingSubscriptionProductChanges"] extends true
      ? "changeSubscriptionProductAtPeriodEnd"
      : never)
  | (TCapabilities["resumeSubscriptionsAtPeriodEnd"] extends true
      ? "resumeSubscriptionAtPeriodEnd"
      : never)
  | (TCapabilities["subscriptionSchedules"] extends true
      ? "getOrCreateSubscriptionSchedule" | "updateSubscriptionSchedulePhases"
      : never)
  | (TCapabilities["testClocks"] extends true ? "advanceTestClock" | "getTestClock" : never)
  | (TCapabilities["manageWebhookEndpoints"] extends true
      ? "deleteWebhookEndpoint" | "ensureWebhookEndpoint" | "getWebhookEndpointAccount"
      : never);

interface PayKitProviderBase<TCapabilities extends PayKitProviderCapabilities> {
  readonly id: string;
  readonly name: string;
  readonly capabilities: TCapabilities;

  /** Creates a provider customer for a PayKit customer. */
  createCustomer(data: {
    createTestClock?: boolean;
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ providerCustomer: ProviderCustomer }>;
  /** Deletes a provider customer. */
  deleteCustomer(data: { providerCustomerId: string }): Promise<void>;
  /** Updates mutable provider customer profile fields. */
  updateCustomer(data: {
    providerCustomerId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<void>;

  /** Retrieves the provider's current normalized subscription snapshot. */
  getSubscription(data: { providerSubscriptionId: string }): Promise<ProviderSubscription>;

  /** Verifies and normalizes provider webhook events. */
  parseWebhook(data: {
    allowStaleSignatures?: boolean;
    body: string;
    headers: Record<string, string>;
  }): Promise<NormalizedWebhookEvent[]>;

  /** Checks provider account health and optional diagnostic details. */
  check?(): Promise<ProviderHealthResult>;
}

interface PayKitProviderCapabilityMethodMap {
  /** Creates or updates one subscription product and returns its provider reference. */
  upsertSubscriptionProduct(data: ProviderProductInput): Promise<ProviderProductResult>;
  /** Optional provider cleanup after billing core has upserted all active products. */
  cleanupSubscriptionProducts?(data: { activeProviderProductIds: string[] }): Promise<void>;

  /** Creates and returns a provider invoice. */
  createInvoice(data: {
    providerCustomerId: string;
    lines: Array<{ amount: number; description: string }>;
    autoAdvance?: boolean;
  }): Promise<ProviderInvoice>;

  /** Creates a hosted setup session for collecting a reusable payment method. */
  createPaymentMethodSetupSession(data: {
    providerCustomerId: string;
    returnURL: string;
  }): Promise<{ url: string }>;

  /** Detaches or removes a reusable provider payment method. */
  detachPaymentMethod(data: { providerMethodId: string }): Promise<void>;

  /** Creates a provider-hosted customer portal session. */
  createCustomerPortalSession(data: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  /** Marks the provider subscription to cancel at the current period end. */
  cancelSubscriptionAtPeriodEnd(data: {
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionResult>;

  /** Creates a provider subscription directly without hosted checkout. */
  createSubscription(data: {
    providerCustomerId: string;
    providerProduct: Record<string, string>;
  }): Promise<ProviderSubscriptionResult>;

  /** Creates a provider-hosted checkout session for a subscription product. */
  createSubscriptionCheckout(data: {
    providerCustomerId: string;
    providerProduct: Record<string, string>;
    successUrl: string;
    cancelUrl?: string;
    metadata?: Record<string, string>;
  }): Promise<{ paymentUrl: string; providerCheckoutSessionId: string }>;

  /** Changes the subscription product immediately. */
  changeSubscriptionProduct(data: {
    providerProduct: Record<string, string>;
    providerSubscriptionId: string;
  }): Promise<ProviderSubscriptionResult>;

  /** Schedules or records a provider-native product change at period end. */
  changeSubscriptionProductAtPeriodEnd(data: {
    providerProduct: Record<string, string>;
    providerSubscriptionId: string;
  }): Promise<ProviderSubscriptionResult>;

  /** Lists active provider subscriptions for a customer. */
  listActiveSubscriptions(data: {
    providerCustomerId: string;
  }): Promise<Array<{ providerSubscriptionId: string }>>;

  /** Clears pending cancellation and provider-native scheduled product changes if possible. */
  resumeSubscriptionAtPeriodEnd(data: {
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionResult>;

  /** Retrieves or creates the provider schedule resource for a subscription. */
  getOrCreateSubscriptionSchedule(data: {
    providerSubscriptionId: string;
    providerSubscriptionScheduleId?: string | null;
  }): Promise<ProviderSubscriptionSchedule>;
  /** Replaces the provider schedule phases with the provided normalized phases. */
  updateSubscriptionSchedulePhases(data: {
    phases: ProviderSubscriptionSchedulePhase[];
    providerSubscriptionScheduleId: string;
  }): Promise<void>;

  /** Advances a deterministic provider test clock. */
  advanceTestClock(data: { testClockId: string; frozenTime: Date }): Promise<ProviderTestClock>;
  /** Retrieves a deterministic provider test clock. */
  getTestClock(data: { testClockId: string }): Promise<ProviderTestClock>;

  /** Returns the provider account identity used to scope webhook endpoint management. */
  getWebhookEndpointAccount(): Promise<ProviderWebhookEndpointAccount>;

  /** Creates or updates the provider webhook endpoint for a PayKit webhook URL. */
  ensureWebhookEndpoint(data: {
    existingEndpointId?: string | null;
    url: string;
  }): Promise<ProviderWebhookEndpointResult>;

  /** Deletes a provider webhook endpoint by provider endpoint ID. */
  deleteWebhookEndpoint(data: { endpointId: string }): Promise<void>;
}

type PayKitProviderCapabilityMethods<TCapabilities extends PayKitProviderCapabilities> = Pick<
  PayKitProviderCapabilityMethodMap,
  CapabilityRequiredMethodKeys<TCapabilities> & CapabilityMethodKeys
> &
  Partial<
    Omit<
      PayKitProviderCapabilityMethodMap,
      CapabilityRequiredMethodKeys<TCapabilities> & CapabilityMethodKeys
    >
  >;

export type PayKitProvider<
  TCapabilities extends PayKitProviderCapabilities = PayKitProviderCapabilities,
> = PayKitProviderBase<TCapabilities> & PayKitProviderCapabilityMethods<TCapabilities>;

type ExactProviderCapabilities<TCapabilities extends PayKitProviderCapabilities> = TCapabilities &
  Record<Exclude<keyof TCapabilities, keyof PayKitProviderCapabilities>, never>;

/**
 * Defines a PayKit payment provider while preserving the provider's exact type.
 * @param provider Provider implementation.
 */
export function defineProvider<
  const TCapabilities extends PayKitProviderCapabilities,
  const TProvider extends PayKitProvider<ExactProviderCapabilities<TCapabilities>>,
>(
  provider: TProvider & { readonly capabilities: ExactProviderCapabilities<TCapabilities> },
): TProvider {
  return provider;
}

/** @deprecated Use {@link PayKitProvider}. */
export type PaymentProvider = PayKitProvider;
