import { describe, expect, it } from "vitest";

import type { PayKitOptions } from "../../types/options";
import { assertValidPayKitOptions } from "../validate-options";

function createOptions(currency?: string): PayKitOptions {
  return {
    database: "postgresql://localhost:5432/paykit",
    stripe: {
      ...(currency ? { currency: currency as never } : {}),
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    },
  };
}

describe("core/validate-options", () => {
  it("accepts usd and eur Stripe currencies", () => {
    expect(() => assertValidPayKitOptions(createOptions("usd"))).not.toThrow();
    expect(() => assertValidPayKitOptions(createOptions("eur"))).not.toThrow();
  });

  it("rejects unsupported Stripe currencies", () => {
    expect(() => assertValidPayKitOptions(createOptions("gbp"))).toThrow(
      "currently supports Stripe currencies: usd, eur",
    );
  });

  it("rejects non-lowercase Stripe currencies", () => {
    expect(() => assertValidPayKitOptions(createOptions("EUR"))).toThrow(
      "must be a lowercase three-letter currency code",
    );
  });
});
