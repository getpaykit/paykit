import type { NormalizedPayment, NormalizedWebhookEvent } from "../types/events";

export interface ProviderPaymentMethod {
  providerMethodId: string;
  type: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface PayKitProvider<TId extends string = string> {
  id: TId;

  upsertCustomer(data: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ providerCustomerId: string }>;

  checkout(data: {
    providerCustomerId: string;
    amount: number;
    description: string;
    successURL: string;
    cancelURL?: string;
    attachMethod?: boolean;
    metadata?: Record<string, string>;
  }): Promise<{ url: string }>;

  attachPaymentMethod(data: {
    providerCustomerId: string;
    returnURL: string;
  }): Promise<{ url: string }>;

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
}

export function defineProvider<const TId extends string>(
  provider: PayKitProvider<TId>,
): PayKitProvider<TId> {
  return provider;
}
