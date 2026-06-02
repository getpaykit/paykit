import { env } from "../env";
import { createStripeHarness } from "./stripe";
import type { ProviderHarness } from "./types";

export type { ProviderHarness } from "./types";

export function loadHarness(): ProviderHarness {
  const provider = env.PROVIDER;

  switch (provider) {
    case "stripe":
      return createStripeHarness();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
