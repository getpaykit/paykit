import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  createPayKitLogger: vi.fn(),
  createStripeAdapter: vi.fn(),
}));

vi.mock("../../database/index", () => ({
  createDatabase: mocks.createDatabase,
}));

vi.mock("../logger", () => ({
  createPayKitLogger: mocks.createPayKitLogger,
}));

vi.mock("../../stripe/stripe-provider", () => ({
  createStripeAdapter: mocks.createStripeAdapter,
}));

import { createContext } from "../context";

describe("core/context", () => {
  beforeEach(() => {
    mocks.createDatabase.mockReset();
    mocks.createPayKitLogger.mockReset();
    mocks.createStripeAdapter.mockReset();
    mocks.createDatabase.mockResolvedValue({ kind: "database" });
    mocks.createPayKitLogger.mockReturnValue({ kind: "logger" });
    mocks.createStripeAdapter.mockReturnValue({ id: "stripe", name: "Stripe" });
  });

  it("passes logging options into the logger factory", async () => {
    const logging = {
      level: "debug",
    } as const;
    const database = {} as Pool;
    const stripe = { secretKey: "sk_test_123", webhookSecret: "whsec_123" };

    const context = await createContext({
      database,
      logging,
      stripe,
    });

    expect(mocks.createDatabase).toHaveBeenCalledWith(database);
    expect(mocks.createStripeAdapter).toHaveBeenCalledWith(stripe);
    expect(mocks.createPayKitLogger).toHaveBeenCalledWith(logging);
    expect(context.logger).toEqual({ kind: "logger" });
    expect(context.provider).toEqual({ id: "stripe", name: "Stripe" });
  });
});
