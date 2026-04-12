import type { BeforeSubscribeHookCtx } from "paykitjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client";
import { DymoPlugin } from "../plugin";

function createMockHookContext(
  overrides: Partial<BeforeSubscribeHookCtx> = {},
): BeforeSubscribeHookCtx {
  return {
    customerId: "customer_123",
    customerEmail: "test@example.com",
    plan: {
      id: "pro-plan",
      name: "Pro Plan",
      priceAmount: 2900,
      priceInterval: "month",
      trialDays: null,
      group: "default",
      hash: "abc123",
      isDefault: false,
      includes: [],
    },
    ip: "192.168.1.1",
    ...overrides,
  };
}

describe("DymoPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow subscription when email and IP are valid", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
      isValidIP: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext();

    await expect(plugin.onBeforeSubscribe?.(ctx)).resolves.not.toThrow();
    expect(mockClient.isValidEmail).toHaveBeenCalledWith("test@example.com");
    expect(mockClient.isValidIP).toHaveBeenCalledWith("192.168.1.1");
  });

  it("should block subscription when email is fraudulent", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockResolvedValue({
        allow: false,
        reasons: ["FRAUD", "DISPOSABLE"],
      }),
      isValidIP: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext();

    await expect(plugin.onBeforeSubscribe?.(ctx)).rejects.toThrow(
      "Fraud detection blocked subscription for test@example.com: FRAUD, DISPOSABLE",
    );
  });

  it("should block subscription when IP is fraudulent", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
      isValidIP: vi.fn().mockResolvedValue({
        allow: false,
        reasons: ["VPN", "TOR_NETWORK"],
      }),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext();

    await expect(plugin.onBeforeSubscribe?.(ctx)).rejects.toThrow(
      "Fraud detection blocked subscription for test@example.com: VPN, TOR_NETWORK",
    );
  });

  it("should skip email check when customerEmail is undefined", async () => {
    const mockClient = {
      isValidEmail: vi.fn(),
      isValidIP: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext({ customerEmail: undefined });

    await expect(plugin.onBeforeSubscribe?.(ctx)).resolves.not.toThrow();
    expect(mockClient.isValidEmail).not.toHaveBeenCalled();
    expect(mockClient.isValidIP).toHaveBeenCalledWith("192.168.1.1");
  });

  it("should skip IP check when ip is undefined", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
      isValidIP: vi.fn(),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext({ ip: undefined });

    await expect(plugin.onBeforeSubscribe?.(ctx)).resolves.not.toThrow();
    expect(mockClient.isValidEmail).toHaveBeenCalledWith("test@example.com");
    expect(mockClient.isValidIP).not.toHaveBeenCalled();
  });

  it("should allow subscription when resilience is enabled and API fails", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockRejectedValue(new Error("API error")),
      isValidIP: vi.fn().mockRejectedValue(new Error("API error")),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: true },
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = createMockHookContext();

    await expect(plugin.onBeforeSubscribe?.(ctx)).resolves.not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalledWith("[PayKit-Dymo] Resilience active: Skipping check.");

    consoleWarnSpy.mockRestore();
  });

  it("should throw when resilience is disabled and API fails", async () => {
    const mockClient = {
      isValidEmail: vi.fn().mockRejectedValue(new Error("API error")),
      isValidIP: vi.fn().mockResolvedValue({
        allow: true,
        reasons: [],
      }),
    };

    vi.spyOn(clientModule, "createDymoClient").mockReturnValue(mockClient);

    const plugin = DymoPlugin({
      apiKey: "test-key",
      resilience: { enabled: false },
    });

    const ctx = createMockHookContext();

    await expect(plugin.onBeforeSubscribe?.(ctx)).rejects.toThrow(
      "Fraud check service unavailable.",
    );
  });

  it("should validate config with Zod on initialization", () => {
    expect(() => {
      DymoPlugin({ apiKey: "", resilience: { enabled: true } });
    }).toThrow("Dymo API Key is required");
  });
});
