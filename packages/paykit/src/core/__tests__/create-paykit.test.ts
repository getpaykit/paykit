import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createContext: vi.fn(),
  getApi: vi.fn(),
  getPendingMigrationCount: vi.fn(),
}));

vi.mock("../context", () => ({
  createContext: mocks.createContext,
}));

vi.mock("../../api/methods", () => ({
  createPayKitRouter: vi.fn(),
  getApi: mocks.getApi,
}));

vi.mock("../../database/index", () => ({
  getPendingMigrationCount: mocks.getPendingMigrationCount,
}));

vi.mock("../../product/product-sync.service", () => ({
  dryRunSyncProducts: vi.fn().mockResolvedValue([]),
}));

import { createPayKit } from "../create-paykit";

describe("core/create-paykit", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPayKitCli = process.env.PAYKIT_CLI;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYKIT_CLI;
    process.env.NODE_ENV = "development";
    mocks.createContext.mockResolvedValue({ kind: "context" });
    mocks.getApi.mockReturnValue({});
    mocks.getPendingMigrationCount.mockResolvedValue(0);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalPayKitCli === undefined) {
      delete process.env.PAYKIT_CLI;
    } else {
      process.env.PAYKIT_CLI = originalPayKitCli;
    }
  });

  it("throws in development when migrations are pending", async () => {
    const database = {} as Pool;
    mocks.getPendingMigrationCount.mockResolvedValue(1);

    const paykit = createPayKit({
      database,
      stripe: { secretKey: "sk_test_123", webhookSecret: "whsec_123" },
    });

    await expect(paykit.$context).rejects.toThrow("1 pending migration");
    expect(mocks.createContext).not.toHaveBeenCalled();
  });

  it("skips the migration assertion in production", async () => {
    process.env.NODE_ENV = "production";
    const database = {} as Pool;

    const paykit = createPayKit({
      database,
      stripe: { secretKey: "sk_test_123", webhookSecret: "whsec_123" },
    });

    await expect(paykit.$context).resolves.toEqual({ kind: "context" });
    expect(mocks.getPendingMigrationCount).not.toHaveBeenCalled();
  });
});
