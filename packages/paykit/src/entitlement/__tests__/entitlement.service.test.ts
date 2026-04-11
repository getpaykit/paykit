import { describe, expect, it, vi } from "vitest";

import { reportEntitlement } from "../entitlement.service";

const createUpdateResult = (balance: number) => [{ balance }];

const createUpdateChain = (result: unknown) => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(result),
    }),
  }),
});

const createSelectChain = (result: unknown) => ({
  from: vi.fn().mockReturnValue({
    innerJoin: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      }),
    }),
  }),
});

const createEntitlementRows = () => [
  {
    balance: 3,
    id: "ent_1",
    nextResetAt: new Date("2024-02-01T00:00:00.000Z"),
    originalLimit: 3,
    resetInterval: "month",
  },
  {
    balance: 4,
    id: "ent_2",
    nextResetAt: new Date("2024-02-01T00:00:00.000Z"),
    originalLimit: 4,
    resetInterval: "month",
  },
];

describe("entitlement/service", () => {
  it("consumes usage across stacked entitlement rows", async () => {
    const txUpdate = vi
      .fn()
      .mockReturnValueOnce(createUpdateChain(createUpdateResult(0)))
      .mockReturnValueOnce(createUpdateChain(createUpdateResult(2)));

    const database = {
      select: vi.fn().mockImplementation(() => createSelectChain(createEntitlementRows())),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({ update: txUpdate });
      }),
    } as never;

    const result = await reportEntitlement(database, {
      amount: 5,
      customerId: "customer_123",
      featureId: "feature_api_calls",
      now: new Date("2024-01-15T00:00:00.000Z"),
    });

    expect(txUpdate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      balance: {
        limit: 7,
        remaining: 2,
        resetAt: new Date("2024-02-01T00:00:00.000Z"),
        unlimited: false,
      },
      success: true,
    });
  });

  it("retries on concurrent conflict without double-deducting", async () => {
    let attempt = 0;

    const database = {
      select: vi.fn().mockImplementation(() => createSelectChain(createEntitlementRows())),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        attempt++;
        if (attempt === 1) {
          // First attempt: row 1 succeeds, row 2 conflicts → tx rolls back
          const txUpdate = vi
            .fn()
            .mockReturnValueOnce(createUpdateChain(createUpdateResult(0)))
            .mockReturnValueOnce(createUpdateChain([]));
          await fn({ update: txUpdate });
        } else {
          // Retry: both rows succeed
          const txUpdate = vi
            .fn()
            .mockReturnValueOnce(createUpdateChain(createUpdateResult(0)))
            .mockReturnValueOnce(createUpdateChain(createUpdateResult(2)));
          await fn({ update: txUpdate });
        }
      }),
    } as never;

    const result = await reportEntitlement(database, {
      amount: 5,
      customerId: "customer_123",
      featureId: "feature_api_calls",
      now: new Date("2024-01-15T00:00:00.000Z"),
    });

    expect(attempt).toBe(2);
    expect(result.success).toBe(true);
  });

  it("fails gracefully after all retries are exhausted", async () => {
    const database = {
      select: vi.fn().mockImplementation(() => createSelectChain(createEntitlementRows())),
      // Every attempt conflicts on the first row
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
        const txUpdate = vi.fn().mockReturnValueOnce(createUpdateChain([]));
        await fn({ update: txUpdate });
      }),
    } as never;

    const result = await reportEntitlement(database, {
      amount: 5,
      customerId: "customer_123",
      featureId: "feature_api_calls",
      now: new Date("2024-01-15T00:00:00.000Z"),
    });

    expect(database.transaction).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
  });
});
