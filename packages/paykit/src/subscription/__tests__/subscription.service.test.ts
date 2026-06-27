import { describe, expect, it, vi } from "vitest";

import type { PayKitDatabase } from "../../database";
import {
  syncSubscriptionBillingState,
  syncSubscriptionFromProvider,
} from "../subscription.service";

function createUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

describe("subscription/service", () => {
  it("syncs provider subscription quantity into the local subscription", async () => {
    const update = createUpdateChain();
    const database = {
      update: vi.fn().mockReturnValue({ set: update.set }),
    } as unknown as PayKitDatabase;

    await syncSubscriptionFromProvider(database, {
      providerSubscription: {
        cancelAtPeriodEnd: false,
        providerSubscriptionId: "sub_123",
        quantity: 3,
        status: "active",
      },
      subscriptionId: "sub_local_123",
    });

    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });

  it("syncs explicit billing state quantity without resetting existing quantity", async () => {
    const update = createUpdateChain();
    const database = {
      query: {
        subscription: {
          findFirst: vi.fn().mockResolvedValue({
            currentPeriodEndAt: null,
            currentPeriodStartAt: null,
            id: "sub_local_123",
            quantity: 1,
            startedAt: null,
            status: "active",
            stripeSubscriptionId: "sub_123",
            stripeSubscriptionScheduleId: null,
          }),
        },
      },
      update: vi.fn().mockReturnValue({ set: update.set }),
    } as unknown as PayKitDatabase;

    await syncSubscriptionBillingState(database, {
      quantity: 4,
      subscriptionId: "sub_local_123",
    });

    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ quantity: 4 }));
  });
});
