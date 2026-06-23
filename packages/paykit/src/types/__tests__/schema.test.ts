import { describe, expect, it } from "vitest";

import { normalizeSchema, plan } from "../schema";

describe("types/schema", () => {
  it("stores configured currency on paid normalized plans", () => {
    const products = [
      plan({
        group: "base",
        id: "pro",
        price: { amount: 29, interval: "month" },
      }),
    ];

    const schema = normalizeSchema(products, { priceCurrency: "eur" });

    expect(schema.planMap.get("pro")?.priceCurrency).toBe("eur");
  });

  it("changes plan hash when configured currency changes", () => {
    const products = [
      plan({
        group: "base",
        id: "pro",
        price: { amount: 29, interval: "month" },
      }),
    ];

    const usd = normalizeSchema(products, { priceCurrency: "usd" });
    const eur = normalizeSchema(products, { priceCurrency: "eur" });

    expect(usd.planMap.get("pro")?.hash).not.toBe(eur.planMap.get("pro")?.hash);
  });

  it("keeps free normalized plans currencyless", () => {
    const products = [
      plan({
        default: true,
        group: "base",
        id: "free",
      }),
    ];

    const schema = normalizeSchema(products, { priceCurrency: "eur" });

    expect(schema.planMap.get("free")?.priceCurrency).toBeNull();
  });
});
