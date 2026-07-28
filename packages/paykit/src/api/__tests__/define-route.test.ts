import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import type { PayKitContext } from "../../core/context";
import { definePayKitMethod, returnUrl } from "../define-route";

function createTestContext(trustedOrigins?: string[]) {
  return {
    logger: { warn: vi.fn() },
    options: {
      database: "postgres://paykit:test@localhost:5432/paykit",
      stripe: {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
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
      new Request("https://api.example.com/paykit/subscribe", {
        headers: { origin: "https://app.example.com" },
      }),
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

    const ctx = createTestContext(["https://app.example.com"]);
    await expect(
      method(
        ctx,
        { successUrl: "/billing/success" },
        new Request("https://api.example.com/paykit/subscribe", {
          headers: { origin: "https://evil.example.com" },
        }),
      ),
    ).rejects.toMatchObject({
      code: "TRUSTED_ORIGIN_INVALID",
    });
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "successUrl",
        origin: "https://evil.example.com",
      }),
      expect.stringContaining("untrusted"),
    );
  });

  it("resolves same-origin relative return URLs without configuration", async () => {
    const method = definePayKitMethod(
      { input: z.object({ successUrl: returnUrl() }) },
      async (ctx) => ctx.input,
    );

    await expect(
      method(
        createTestContext(),
        { successUrl: "/billing/success" },
        new Request("https://app.example.com/paykit/subscribe", {
          headers: { origin: "https://app.example.com" },
        }),
      ),
    ).resolves.toEqual({ successUrl: "https://app.example.com/billing/success" });
  });

  it("rejects unsafe schemes and paths", async () => {
    const method = definePayKitMethod(
      { input: z.object({ successUrl: returnUrl() }) },
      async (ctx) => ctx.input,
    );
    const request = new Request("https://app.example.com/paykit/subscribe", {
      headers: { origin: "https://app.example.com" },
    });

    for (const successUrl of [
      "javascript:alert(1)",
      "data:text/html,test",
      "//evil.example.com/path",
      "/\\evil.example.com/path",
      "/safe%2f..%2fevil",
    ]) {
      await expect(method(createTestContext(), { successUrl }, request)).rejects.toBeDefined();
    }
  });

  it("allows trusted direct server calls to use absolute HTTP URLs", async () => {
    const method = definePayKitMethod(
      { input: z.object({ successUrl: returnUrl() }) },
      async (ctx) => ctx.input,
    );

    await expect(
      method(createTestContext(), { successUrl: "https://client.example.com/success" }),
    ).resolves.toEqual({ successUrl: "https://client.example.com/success" });
  });

  it("allows trusted absolute browser return URLs and rejects untrusted ones", async () => {
    const method = definePayKitMethod(
      { input: z.object({ successUrl: returnUrl() }) },
      async (ctx) => ctx.input,
    );
    const request = new Request("https://api.example.com/paykit/subscribe", {
      headers: { origin: "https://app.example.com" },
    });
    const ctx = createTestContext(["https://app.example.com"]);

    await expect(
      method(ctx, { successUrl: "https://app.example.com/success" }, request),
    ).resolves.toEqual({ successUrl: "https://app.example.com/success" });
    await expect(
      method(ctx, { successUrl: "https://evil.example.com/success?token=secret" }, request),
    ).rejects.toMatchObject({ code: "TRUSTED_ORIGIN_INVALID" });
    expect(ctx.logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("secret") }),
      expect.anything(),
    );
  });

  it("explains when a relative server return URL has no browser origin", async () => {
    const method = definePayKitMethod(
      { input: z.object({ successUrl: returnUrl() }) },
      async (ctx) => ctx.input,
    );
    const ctx = createTestContext();

    await expect(method(ctx, { successUrl: "/success" })).rejects.toMatchObject({
      code: "RETURN_URL_ORIGIN_REQUIRED",
    });
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ field: "successUrl" }),
      expect.stringContaining("Could not resolve"),
    );
  });
});
