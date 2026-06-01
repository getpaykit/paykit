import { describe, expect, it } from "vitest";
import * as z from "zod";

import type { PayKitContext } from "../../core/context";
import { definePayKitMethod, returnUrl } from "../define-route";

function createTestContext(trustedOrigins?: string[]) {
  return {
    options: {
      database: "postgres://paykit:test@localhost:5432/paykit",
      provider: {
        id: "stripe",
        name: "Stripe",
      },
      trustedOrigins,
    },
  } as unknown as PayKitContext;
}

describe("api/define-route", () => {
  it("resolves relative return URLs for trusted origins", async () => {
    const method = definePayKitMethod(
      {
        input: z.object({
          successUrl: returnUrl(),
        }),
      },
      async (ctx) => ctx.input,
    );

    const result = await method(
      createTestContext(["https://app.example.com"]),
      { successUrl: "/billing/success" },
      new Request("https://app.example.com/paykit/subscribe"),
    );

    expect(result).toEqual({
      successUrl: "https://app.example.com/billing/success",
    });
  });

  it("rejects relative return URLs for untrusted origins", async () => {
    const method = definePayKitMethod(
      {
        input: z.object({
          successUrl: returnUrl(),
        }),
      },
      async (ctx) => ctx.input,
    );

    await expect(
      method(
        createTestContext(["https://app.example.com"]),
        { successUrl: "/billing/success" },
        new Request("https://evil.example.com/paykit/subscribe"),
      ),
    ).rejects.toMatchObject({
      code: "TRUSTED_ORIGIN_INVALID",
    });
  });
});
