import { describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import { createPayKitEndpoint } from "../define-route";
import { createPayKitRouter } from "../methods";

function createTestContext() {
  const handleWebhook = vi.fn().mockResolvedValue([]);
  const trace = vi.fn() as unknown as PayKitContext["logger"]["trace"];
  trace.run = (_prefix, fn) => fn();

  const ctx = {
    basePath: "/paykit",
    database: {},
    logger: {
      error: vi.fn(),
      trace,
      warn: vi.fn(),
    },
    options: {
      database: "postgres://paykit:test@localhost:5432/paykit",
      plugins: [
        {
          id: "test-dash",
          endpoints: {
            dashUI: createPayKitEndpoint(
              "/dash",
              { method: "GET" },
              async () => new Response("dash"),
            ),
          },
        },
      ],
      stripe: {
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      },
    },
    products: { plans: [] },
    provider: {
      handleWebhook,
      id: "stripe",
      name: "Stripe",
    },
  } as unknown as PayKitContext;

  return { ctx, handleWebhook };
}

describe("api/methods router", () => {
  it("serves plugin endpoints through the public /api prefix", async () => {
    const { ctx } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(new Request("https://example.com/paykit/api/dash"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("dash");
  });

  it("rewrites GET /paykit to the dashboard endpoint", async () => {
    const { ctx } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(new Request("https://example.com/paykit"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("dash");
  });

  it("rewrites legacy provider webhook URLs to the canonical webhook route", async () => {
    const { ctx, handleWebhook } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(
      new Request("https://example.com/paykit/api/webhook/stripe", {
        body: '{"ok":true}',
        headers: { "x-test": "1" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(handleWebhook).toHaveBeenCalledWith({
      allowUnsignedPayload: false,
      body: '{"ok":true}',
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "x-test": "1",
      },
    });
  });

  it("rejects form bodies on customer API routes", async () => {
    const { ctx } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(
      new Request("https://example.com/paykit/api/customer-portal", {
        body: "returnUrl=%2Fbilling",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: "session=test",
          origin: "https://example.com",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(415);
  });

  it("rejects cookie-authenticated customer requests without an origin", async () => {
    const { ctx } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(
      new Request("https://example.com/paykit/api/customer-portal", {
        body: JSON.stringify({ returnUrl: "/billing" }),
        headers: { "content-type": "application/json", cookie: "session=test" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_ORIGIN_REQUIRED" });
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: "REQUEST_ORIGIN_REQUIRED" }),
      expect.stringContaining("without a browser origin"),
    );
  });

  it("rejects cookie-authenticated customer requests from untrusted origins", async () => {
    const { ctx } = createTestContext();
    const router = createPayKitRouter(ctx);

    const response = await router.handler(
      new Request("https://api.example.com/paykit/api/customer-portal", {
        body: JSON.stringify({ returnUrl: "/billing" }),
        headers: {
          "content-type": "application/json",
          cookie: "session=test",
          origin: "https://evil.example.com",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "TRUSTED_ORIGIN_INVALID" });
  });
});
