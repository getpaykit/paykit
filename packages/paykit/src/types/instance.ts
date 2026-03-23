import type { Customer } from "./models";

export interface CustomerIdentity {
  id: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface PayKitInstance {
  customers: {
    create(input: CustomerIdentity): Promise<Customer>;
    get(input: { id: string }): Promise<Customer | null>;
    delete(input: { id: string }): Promise<void>;
  };
  handleWebhook(input: {
    body: string;
    headers: Record<string, string>;
  }): Promise<{ received: true }>;
  $context: Promise<unknown>;
}
