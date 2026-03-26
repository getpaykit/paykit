export interface Customer {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string> | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalProviderCustomer {
  id: string;
  customerId: string;
  providerId: string;
  providerCustomerId: string;
  createdAt: Date;
}

export interface StoredFeature {
  id: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredProduct {
  internalId: string;
  id: string;
  version: number;
  name: string;
  group: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPrice {
  id: string;
  productInternalId: string;
  amount: number;
  interval: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredProductFeature {
  productInternalId: string;
  featureId: string;
  limit: number | null;
  resetInterval: string | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredProviderProduct {
  productInternalId: string;
  providerId: string;
  providerProductId: string;
  createdAt: Date;
}

export interface StoredProviderPrice {
  priceId: string;
  providerId: string;
  providerPriceId: string;
  createdAt: Date;
}

export interface StoredCustomerProduct {
  id: string;
  customerId: string;
  productInternalId: string;
  subscriptionId: string | null;
  providerId: string;
  providerCheckoutSessionId: string | null;
  status: string;
  canceled: boolean;
  startedAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodStartAt: Date | null;
  currentPeriodEndAt: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  scheduledProductId: string | null;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSubscription {
  id: string;
  customerId: string;
  customerProductId: string | null;
  providerId: string;
  providerSubscriptionId: string;
  providerSubscriptionScheduleId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStartAt: Date | null;
  currentPeriodEndAt: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredInvoice {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  providerId: string;
  providerInvoiceId: string;
  status: string;
  currency: string;
  totalAmount: number;
  hostedUrl: string | null;
  periodStartAt: Date | null;
  periodEndAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
