import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StripeRuntime } from "../../providers/provider";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  createPayKitLogger: vi.fn(),
  createStripeRuntime: vi.fn(),
}));

vi.mock("../../database/index", () => ({
  createDatabase: mocks.createDatabase,
  isDrizzleAdapter: () => false,
}));

vi.mock("../logger", () => ({
  createPayKitLogger: mocks.createPayKitLogger,
}));

vi.mock("../../providers/stripe", () => ({
  createStripeRuntime: mocks.createStripeRuntime,
}));

import { createContext } from "../context";

describe("core/context", () => {
  beforeEach(() => {
    mocks.createDatabase.mockReset();
    mocks.createPayKitLogger.mockReset();
    mocks.createStripeRuntime.mockReset();
    mocks.createDatabase.mockResolvedValue({ kind: "database" });
    mocks.createPayKitLogger.mockReturnValue({ kind: "logger" });
    mocks.createStripeRuntime.mockReturnValue({ kind: "stripe-runtime" });
  });

  it("passes logging options into the logger factory", async () => {
    const logging = {
      level: "debug",
    } as const;
    const database = {} as Pool;
    const runtime = { kind: "runtime" } as unknown as StripeRuntime;
    const provider = {
      currency: "usd",
      id: "stripe",
      kind: "stripe",
      runtime,
      secretKey: "sk_test_123",
      webhookSecret: "whsec_test_123",
    } as const;

    const context = await createContext({
      database,
      logging,
      provider,
    });

    expect(mocks.createDatabase).toHaveBeenCalledWith(database);
    expect(mocks.createStripeRuntime).not.toHaveBeenCalled();
    expect(mocks.createPayKitLogger).toHaveBeenCalledWith(logging);
    expect(context.logger).toEqual({ kind: "logger" });
  });
});
