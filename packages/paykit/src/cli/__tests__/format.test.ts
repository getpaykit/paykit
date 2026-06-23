import { describe, expect, it } from "vitest";

import { formatPrice } from "../utils/format";

describe("cli/format", () => {
  it("formats monthly prices in eur", () => {
    expect(formatPrice(2900, "month", "eur")).toBe("€29/mo");
  });

  it("formats decimal prices in eur", () => {
    expect(formatPrice(2999, "month", "eur")).toBe("€29.99/mo");
  });
});
