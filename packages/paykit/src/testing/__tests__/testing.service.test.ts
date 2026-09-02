import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayKitContext } from "../../core/context";
import { PAYKIT_ERROR_CODES } from "../../core/errors";
import type { Customer } from "../../types/models";

const mocks = vi.hoisted(() => ({
  getCustomerByIdOrThrow: vi.fn(),
  getProviderCustomer: vi.fn(),
  setProviderCustomer: vi.fn(),
}));

vi.mock("../../customer/customer.service", () => mocks);

import {
  advanceCustomerTestClock,
  getCustomerCurrentTime,
  getCustomerTestClock,
} from "../testing.service";

const customer = { id: "customer_123" } as Customer;
const providerCustomer = {
  frozenTime: "2026-01-01T00:00:00.000Z",
  id: "cus_123",
  testClockId: "clock_123",
};

function createContext(testingEnabled = true) {
  return {
    database: { kind: "database" },
    options: testingEnabled ? { testing: { enabled: true } } : {},
    provider: {
      advanceTestClock: vi.fn(),
      getTestClock: vi.fn(),
      id: "stripe",
    },
  } as unknown as PayKitContext;
}

describe("testing/service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCustomerByIdOrThrow.mockResolvedValue(customer);
    mocks.getProviderCustomer.mockReturnValue(providerCustomer);
  });

  it("rejects test clock access when testing mode is disabled", async () => {
    await expect(getCustomerTestClock(createContext(false), "customer_123")).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.TESTING_NOT_ENABLED.code,
    });
    expect(mocks.getCustomerByIdOrThrow).not.toHaveBeenCalled();
  });

  it("rejects customers that do not have a provider customer", async () => {
    mocks.getProviderCustomer.mockReturnValue(null);

    await expect(getCustomerTestClock(createContext(), "customer_123")).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND.code,
    });
  });

  it("rejects provider customers without a test clock", async () => {
    mocks.getProviderCustomer.mockReturnValue({ id: "cus_123" });

    await expect(getCustomerTestClock(createContext(), "customer_123")).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.TEST_CLOCK_NOT_FOUND.code,
    });
  });

  it("refreshes and stores the provider test clock", async () => {
    const ctx = createContext();
    const testClock = {
      frozenTime: new Date("2026-02-01T00:00:00.000Z"),
      id: "clock_123",
      status: "ready",
    };
    vi.mocked(ctx.provider.getTestClock).mockResolvedValue(testClock);

    await expect(getCustomerTestClock(ctx, "customer_123")).resolves.toBe(testClock);
    expect(ctx.provider.getTestClock).toHaveBeenCalledWith({ testClockId: "clock_123" });
    expect(mocks.setProviderCustomer).toHaveBeenCalledWith(ctx.database, {
      customerId: "customer_123",
      providerCustomer: {
        ...providerCustomer,
        frozenTime: "2026-02-01T00:00:00.000Z",
      },
      providerId: "stripe",
    });
  });

  it("advances and stores the provider test clock", async () => {
    const ctx = createContext();
    const frozenTime = new Date("2026-03-01T00:00:00.000Z");
    const testClock = { frozenTime, id: "clock_123", status: "advancing" };
    vi.mocked(ctx.provider.advanceTestClock).mockResolvedValue(testClock);

    await expect(
      advanceCustomerTestClock(ctx, { customerId: "customer_123", frozenTime }),
    ).resolves.toBe(testClock);
    expect(ctx.provider.advanceTestClock).toHaveBeenCalledWith({
      frozenTime,
      testClockId: "clock_123",
    });
    expect(mocks.setProviderCustomer).toHaveBeenCalledWith(ctx.database, {
      customerId: "customer_123",
      providerCustomer: {
        ...providerCustomer,
        frozenTime: "2026-03-01T00:00:00.000Z",
      },
      providerId: "stripe",
    });
  });

  it("uses the stored frozen time in testing mode", () => {
    expect(getCustomerCurrentTime(createContext(), customer)).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("uses wall-clock time outside testing mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    expect(getCustomerCurrentTime(createContext(false), customer)).toEqual(
      new Date("2026-04-01T00:00:00.000Z"),
    );

    vi.useRealTimers();
  });
});
