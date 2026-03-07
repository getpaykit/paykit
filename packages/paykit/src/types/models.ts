export interface Customer {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string> | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  providerId: string;
  providerMethodId: string;
  type: string;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalPaymentMethod extends PaymentMethod {
  customerId: string;
}

export interface Payment {
  id: string;
  paymentMethodId: string | null;
  providerId: string;
  providerPaymentId: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalPayment extends Payment {
  customerId: string;
}

export interface InternalProviderCustomer {
  id: string;
  customerId: string;
  providerId: string;
  providerCustomerId: string;
  createdAt: Date;
}

export interface Refund {
  amount: number;
  currency: string;
  providerRefundId?: string | null;
  status: string;
}
