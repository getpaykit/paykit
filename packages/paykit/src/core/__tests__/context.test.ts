import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitProvider } from "../../providers/provider";

const testCapabilities: PayKitProvider["capabilities"] = {
  subscriptionProducts: true,
  subscriptionCheckout: true,
  customerPortal: true,
  createInvoices: true,
  detachPaymentMethods: true,
  setupPaymentMethods: true,
  cancelSubscriptionsAtPeriodEnd: true,
  createSubscriptions: true,
  changeSubscriptionProducts: true,
  listActiveSubscriptions: true,
  pendingSubscriptionProductChanges: false,
  resumeSubscriptionsAtPeriodEnd: true,
  subscriptionSchedules: false,
  testClocks: false,
  manageWebhookEndpoints: false,
};

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  createPayKitLogger: vi.fn(),
}));

vi.mock("../../database/index", () => ({
  createDatabase: mocks.createDatabase,
}));

vi.mock("../logger", () => ({
  createPayKitLogger: mocks.createPayKitLogger,
}));

import { createContext } from "../context";

describe("core/context", () => {
  beforeEach(() => {
    mocks.createDatabase.mockReset();
    mocks.createPayKitLogger.mockReset();
    mocks.createDatabase.mockResolvedValue({ kind: "database" });
    mocks.createPayKitLogger.mockReturnValue({ kind: "logger" });
  });

  it("passes logging options into the logger factory", async () => {
    const logging = {
      level: "debug",
    } as const;
    const database = {} as Pool;
    const provider = {
      capabilities: testCapabilities,
      id: "test",
      name: "Test",
    } as unknown as PayKitProvider;

    const context = await createContext({
      database,
      logging,
      provider,
    });

    expect(mocks.createDatabase).toHaveBeenCalledWith(database);
    expect(mocks.createPayKitLogger).toHaveBeenCalledWith(logging);
    expect(context.logger).toEqual({ kind: "logger" });
    expect(context.provider).toBe(provider);
  });
});
