import type { PayKitProvider } from "paykitjs";

import type { PayKitContext } from "../../../packages/paykit/src/core/context";

export interface ProviderCapabilities {
  testClocks: boolean;
  directSubscription: boolean;
  invoiceWebhooks: boolean;
  /** Hosted checkout can be used repeatedly inside provider-agnostic billing tests. */
  repeatedHostedCheckout: boolean;
}

export interface ProviderHarness {
  id: string;
  capabilities: ProviderCapabilities;

  createProvider(): PayKitProvider;

  /**
   * Apply testing-only overrides to the PayKit provider (e.g., Stripe's
   * allow_incomplete to bypass client-side confirmation). No-op if the
   * provider doesn't need any test-mode tweaks.
   */
  applyTestingOverrides?(ctx: PayKitContext): void;

  /**
   * Make the customer ready to subscribe without checkout (e.g., attach PM for Stripe).
   * For providers that only support checkout, this is a no-op.
   */
  setupCustomerForDirectSubscription(providerCustomerId: string): Promise<void>;

  /** Complete a hosted checkout given the URL (e.g., Playwright automation). */
  completeCheckout(url: string): Promise<void>;

  /** Provider-specific cleanup (e.g., delete test clocks). */
  cleanup(ctx: { providerCustomerIds: string[] }): Promise<void>;

  validateEnv(): void;
}
