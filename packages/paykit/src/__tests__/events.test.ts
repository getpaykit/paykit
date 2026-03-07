import { describe, expectTypeOf, it } from "vitest";

import type {
  AnyPayKitEvent,
  PayKitCatchAllEvent,
  PayKitEvent,
  PayKitEventHandlers,
} from "../types/events";
import type { Customer } from "../types/models";

describe("paykit events", () => {
  it("should export typed event helpers for users", () => {
    expectTypeOf<PayKitEvent<"checkout.completed">["name"]>().toEqualTypeOf<"checkout.completed">();
    expectTypeOf<PayKitEvent<"checkout.completed">["payload"]>().toMatchTypeOf<{
      checkoutSessionId: string;
      customer: Customer;
      paymentStatus: string | null;
      providerId: string;
      status: string | null;
    }>();

    const handlers: PayKitEventHandlers = {
      "*": ({ event }) => {
        expectTypeOf(event).toEqualTypeOf<AnyPayKitEvent>();
      },
      "checkout.completed": (event) => {
        expectTypeOf(event).toEqualTypeOf<PayKitEvent<"checkout.completed">>();
        expectTypeOf(event.payload.customer.id).toEqualTypeOf<string>();
      },
      "payment.succeeded": (event) => {
        expectTypeOf(event).toEqualTypeOf<PayKitEvent<"payment.succeeded">>();
        expectTypeOf(event.payload.payment.providerPaymentId).toEqualTypeOf<string>();
      },
      "payment_method.attached": (event) => {
        expectTypeOf(event).toEqualTypeOf<PayKitEvent<"payment_method.attached">>();
        expectTypeOf(event.payload.paymentMethod.providerMethodId).toEqualTypeOf<string>();
      },
    };

    expectTypeOf(handlers).toMatchTypeOf<PayKitEventHandlers>();
    expectTypeOf<PayKitCatchAllEvent["event"]>().toEqualTypeOf<AnyPayKitEvent>();
  });
});
