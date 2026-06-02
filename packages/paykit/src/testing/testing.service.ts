import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import {
  getCustomerByIdOrThrow,
  getProviderCustomer,
  setProviderCustomer,
} from "../customer/customer.service";
import type { Customer } from "../types/models";

function assertTestingEnabled(ctx: PayKitContext): void {
  if (ctx.options.testing?.enabled !== true) {
    throw PayKitError.from("BAD_REQUEST", PAYKIT_ERROR_CODES.TESTING_NOT_ENABLED);
  }
}

export async function getCustomerTestClock(ctx: PayKitContext, customerId: string) {
  assertTestingEnabled(ctx);
  const customer = await getCustomerByIdOrThrow(ctx.database, customerId);
  const providerCustomer = getProviderCustomer(customer, ctx.provider.id);
  if (!providerCustomer) {
    throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND);
  }

  if (!providerCustomer.testClockId) {
    throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.TEST_CLOCK_NOT_FOUND);
  }

  const testClock = await ctx.provider.getTestClock({ testClockId: providerCustomer.testClockId });
  await setProviderCustomer(ctx.database, {
    customerId,
    providerCustomer: {
      ...providerCustomer,
      frozenTime: testClock.frozenTime.toISOString(),
    },
    providerId: ctx.provider.id,
  });
  return testClock;
}

export function getCustomerCurrentTime(ctx: PayKitContext, customer: Customer): Date {
  if (ctx.options.testing?.enabled !== true) {
    return new Date();
  }

  const providerCustomer = getProviderCustomer(customer, ctx.provider.id);
  if (!providerCustomer?.frozenTime) {
    return new Date();
  }

  return new Date(providerCustomer.frozenTime);
}

export async function advanceCustomerTestClock(
  ctx: PayKitContext,
  input: { customerId: string; frozenTime: Date },
) {
  assertTestingEnabled(ctx);
  const customer = await getCustomerByIdOrThrow(ctx.database, input.customerId);
  const providerCustomer = getProviderCustomer(customer, ctx.provider.id);
  if (!providerCustomer) {
    throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.PROVIDER_CUSTOMER_NOT_FOUND);
  }

  if (!providerCustomer.testClockId) {
    throw PayKitError.from("NOT_FOUND", PAYKIT_ERROR_CODES.TEST_CLOCK_NOT_FOUND);
  }

  const testClock = await ctx.provider.advanceTestClock({
    frozenTime: input.frozenTime,
    testClockId: providerCustomer.testClockId,
  });
  await setProviderCustomer(ctx.database, {
    customerId: input.customerId,
    providerCustomer: {
      ...providerCustomer,
      frozenTime: testClock.frozenTime.toISOString(),
    },
    providerId: ctx.provider.id,
  });
  return testClock;
}
