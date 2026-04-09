import { describe, expect, it, vi } from "vitest";

import { paykitIdentify, paykitPlugin } from "../plugin";

describe("paykitPlugin", () => {
  it("should return a BetterAuthPlugin with id 'paykit'", () => {
    const mockPaykit = { upsertCustomer: vi.fn() } as never;
    const plugin = paykitPlugin(mockPaykit);
    expect(plugin.id).toBe("paykit");
  });

  it("should register an after hook for sign-up paths", () => {
    const mockPaykit = { upsertCustomer: vi.fn() } as never;
    const plugin = paykitPlugin(mockPaykit);
    expect(plugin.hooks?.after).toHaveLength(1);
  });

  it("matcher should match email and social sign-up paths", () => {
    const mockPaykit = { upsertCustomer: vi.fn() } as never;
    const plugin = paykitPlugin(mockPaykit);
    const hook = plugin.hooks!.after![0]!;
    expect(hook.matcher({ path: "/sign-up/email" } as never)).toBe(true);
    expect(hook.matcher({ path: "/sign-up/social" } as never)).toBe(true);
    expect(hook.matcher({ path: "/sign-in/email" } as never)).toBe(false);
  });
});

describe("paykitIdentify", () => {
  it("should return null when there is no session", async () => {
    const mockAuth = {
      api: { getSession: vi.fn().mockResolvedValue(null) },
    } as never;
    const identify = paykitIdentify(mockAuth);
    const result = await identify(new Request("https://example.com"));
    expect(result).toBeNull();
  });

  it("should return customer fields from the session", async () => {
    const mockAuth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: "user_1", email: "test@example.com", name: "Test User" },
        }),
      },
    } as never;
    const identify = paykitIdentify(mockAuth);
    const result = await identify(new Request("https://example.com"));
    expect(result).toEqual({
      customerId: "user_1",
      email: "test@example.com",
      name: "Test User",
    });
  });

  it("should omit name when it is null", async () => {
    const mockAuth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: "user_2", email: "test@example.com", name: null },
        }),
      },
    } as never;
    const identify = paykitIdentify(mockAuth);
    const result = await identify(new Request("https://example.com"));
    expect(result).toEqual({
      customerId: "user_2",
      email: "test@example.com",
      name: undefined,
    });
  });
});
