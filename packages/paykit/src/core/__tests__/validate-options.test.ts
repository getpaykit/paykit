import { describe, expect, it } from "vitest";

import type { PayKitOptions } from "../../types/options";
import { assertValidPayKitOptions } from "../validate-options";

function createOptions(currency?: string): PayKitOptions {
  return {
    database: "postgresql://localhost:5432/paykit",
    stripe: {
      ...(currency !== undefined ? { currency: currency as never } : {}),
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

  it("rejects empty Stripe currency", () => {
    expect(() => assertValidPayKitOptions(createOptions(""))).toThrow(
      "must be a lowercase three-letter currency code",
    );
  });

  it.each(["sk_test_123", "rk_test_123"])(
    "accepts testing mode with Stripe test credential %s",
    (secretKey) => {
      const options = createOptions();
      options.stripe.secretKey = secretKey;
      options.testing = { enabled: true };

      expect(() => assertValidPayKitOptions(options)).not.toThrow();
    },
  );

  it.each(["sk_live_123", "rk_live_123", "invalid"])(
    "rejects testing mode with non-test credential %s",
    (secretKey) => {
      const options = createOptions();
      options.stripe.secretKey = secretKey;
      options.testing = { enabled: true };

      expect(() => assertValidPayKitOptions(options)).toThrow(
        "testing mode requires a Stripe test-mode secret or restricted key",
      );
    },
  );
});
