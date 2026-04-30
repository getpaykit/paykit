import { env } from "../env";
import { createDodopaymentsHarness } from "./dodopayments";
import { createPolarHarness } from "./polar";
import { createStripeHarness } from "./stripe";
import type { ProviderHarness } from "./types";

export type { ProviderCapabilities, ProviderHarness } from "./types";

export function loadHarness(): ProviderHarness {
  const provider = env.PROVIDER;

  switch (provider) {
    case "stripe":
      return createStripeHarness();
    case "polar":
      return createPolarHarness();
    case "dodopayments":
      return createDodopaymentsHarness();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
