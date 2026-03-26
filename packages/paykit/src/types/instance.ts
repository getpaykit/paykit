import type { CheckResult, ReportResult } from "../services/entitlement-service";
import type { Customer } from "./models";
import type { PayKitOptions } from "./options";
import type { PlanIdFromPlans } from "./schema";

type PlanIdFromOptions<TOptions extends PayKitOptions> = [
  PlanIdFromPlans<TOptions["plans"]>,
] extends [never]
  ? string
  : PlanIdFromPlans<TOptions["plans"]>;

export type PayKitSubscribeInput<TOptions extends PayKitOptions = PayKitOptions> = {
  planId: PlanIdFromOptions<TOptions>;
  successUrl?: string;
  cancelUrl?: string;
  customerId?: string;
  redirectMode?: "always" | "if_required" | "never";
};

export interface PayKitSubscribeResult {
  invoice?: {
    currency: string;
    hostedUrl: string | null;
    providerInvoiceId: string;
    status: string | null;
    totalAmount: number;
  };
  paymentUrl: string | null;
  requiredAction?: {
    clientSecret?: string;
    paymentIntentId?: string;
    type: string;
  } | null;
}

type PayKitEndpoint<TPath extends string, TBody, TResult> = ((ctx: {
  body: TBody;
}) => Promise<TResult>) & {
  path: TPath;
  options: unknown;
};

export interface PayKitAPI<TOptions extends PayKitOptions = PayKitOptions> {
  subscribe: PayKitEndpoint<"/subscribe", PayKitSubscribeInput<TOptions>, PayKitSubscribeResult>;
}

export interface PayKitInstance<TOptions extends PayKitOptions = PayKitOptions> {
  options: TOptions;
  handler: (request: Request) => Promise<Response>;
  api: PayKitAPI<TOptions>;
  ensureCustomer(input: {
    id: string;
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Customer>;
  subscribe(input: PayKitSubscribeInput<TOptions>): Promise<PayKitSubscribeResult>;
  check(input: { customerId: string; featureId: string; required?: number }): Promise<CheckResult>;
  report(input: { customerId: string; featureId: string; amount?: number }): Promise<ReportResult>;
  handleWebhook(input: {
    body: string;
    headers: Record<string, string>;
  }): Promise<{ received: true }>;
  $context: Promise<unknown>;
}
