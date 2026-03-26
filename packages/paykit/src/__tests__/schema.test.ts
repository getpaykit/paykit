import { describe, expect, it } from "vitest";

import { feature, isPayKitPlan, normalizeSchema, plan } from "../types/schema";

describe("paykit schema", () => {
  it("should detect branded plans and ignore non-plan exports", () => {
    const messagesFeature = feature({ id: "messages", type: "metered" });
    const free = plan({
      default: true,
      group: "base",
      id: "free",
      includes: [messagesFeature({ limit: 50, reset: "month" })],
    });

    expect(isPayKitPlan(free)).toBe(true);
    expect(isPayKitPlan({ id: "free" })).toBe(false);

    const normalized = normalizeSchema({
      free,
      helper: () => "not a plan",
      value: 42,
    });

    expect(normalized.plans).toHaveLength(1);
    expect(normalized.features).toEqual([{ id: "messages", type: "metered" }]);
  });

  it("should infer features from plan includes without exporting them", () => {
    const messagesFeature = feature({ id: "messages", type: "metered" });
    const proModelsFeature = feature({ id: "pro_models", type: "boolean" });

    const normalized = normalizeSchema({
      pro: plan({
        group: "base",
        id: "pro",
        includes: [messagesFeature({ limit: 1000, reset: "month" }), proModelsFeature()],
        price: { amount: 20, interval: "month" },
      }),
    });

    expect(normalized.features).toEqual([
      { id: "messages", type: "metered" },
      { id: "pro_models", type: "boolean" },
    ]);
  });

  it("should require a group for default plans", () => {
    expect(() =>
      plan({
        default: true,
        id: "free",
      }),
    ).toThrow('Default plans must define a "group"');
  });

  it("should reject conflicting feature definitions", () => {
    const messagesBooleanFeature = feature({ id: "messages", type: "boolean" });
    const messagesMeteredFeature = feature({ id: "messages", type: "metered" });

    expect(() =>
      normalizeSchema({
        free: plan({
          group: "base",
          id: "free",
          includes: [messagesBooleanFeature()],
        }),
        pro: plan({
          group: "base",
          id: "pro",
          includes: [messagesMeteredFeature({ limit: 100, reset: "month" })],
          price: { amount: 20, interval: "month" },
        }),
      }),
    ).toThrow('Feature "messages" is declared with conflicting types');
  });
});
