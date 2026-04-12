import { describe, expect, it } from "vitest";

import {
  addInterval,
  getSecondInterval,
  getStripeRecurringInterval,
  meteredResetIntervalSchema,
} from "../interval";
import { feature, normalizeSchema, plan } from "../schema";

describe("types/interval", () => {
  it("accepts the new provider-safe plan intervals", () => {
    expect(() =>
      plan({
        id: "daily",
        price: { amount: 10, interval: "day" },
      }),
    ).not.toThrow();

    expect(() =>
      plan({
        id: "quarterly",
        price: { amount: 10, interval: "quarterly" },
      }),
    ).not.toThrow();

    expect(() =>
      plan({
        id: "biyear",
        price: { amount: 10, interval: "biyear" },
      }),
    ).not.toThrow();
  });

  it("accepts named and numeric meter reset intervals", () => {
    const messages = feature({ id: "messages", type: "metered" });
    const jobs = feature({ id: "jobs", type: "metered" });
    const normalized = normalizeSchema([
      plan({
        id: "pro",
        includes: [messages({ limit: 100, reset: "biweek" }), jobs({ limit: 200, reset: 90 })],
      }),
    ]);

    expect(normalized.plans[0]?.includes.map((include) => include.resetInterval)).toEqual([
      90,
      "biweek",
    ]);
  });

  it("adds the new reset intervals correctly", () => {
    expect(addInterval(new Date("2024-01-01T00:00:00.000Z"), "biweek").toISOString()).toBe(
      "2024-01-15T00:00:00.000Z",
    );
    expect(addInterval(new Date("2024-01-31T00:00:00.000Z"), "quarterly").toISOString()).toBe(
      "2024-04-30T00:00:00.000Z",
    );
    expect(addInterval(new Date("2024-01-31T00:00:00.000Z"), "biyear").toISOString()).toBe(
      "2024-07-31T00:00:00.000Z",
    );
    expect(addInterval(new Date("2024-01-01T00:00:00.000Z"), 90).toISOString()).toBe(
      "2024-01-01T00:01:30.000Z",
    );
    expect(addInterval(new Date("2024-01-01T00:00:00.000Z"), "90").toISOString()).toBe(
      "2024-01-01T00:01:30.000Z",
    );
  });

  it("maps quarterly and biyear Stripe intervals with counts", () => {
    expect(getStripeRecurringInterval("quarterly")).toEqual({ count: 3, interval: "month" });
    expect(getStripeRecurringInterval("biyear")).toEqual({ count: 6, interval: "month" });
    expect(getStripeRecurringInterval("week")).toEqual({ interval: "week" });
  });

  it("round-trips numeric second resets through the shared schema", () => {
    expect(meteredResetIntervalSchema.parse("90")).toBe(90);
    expect(meteredResetIntervalSchema.parse(90)).toBe(90);
    expect(getSecondInterval("90")).toBe(90);
  });
});
