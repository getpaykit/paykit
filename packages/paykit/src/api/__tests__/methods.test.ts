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
      provider: {
        id: "stripe",
        name: "Stripe",
      },
    },
    products: { plans: [] },
    provider: {
      id: "stripe",
      name: "Stripe",
      parseWebhook: handleWebhook,
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
      allowStaleSignatures: false,
      body: '{"ok":true}',
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "x-test": "1",
      },
    });
  });
});
