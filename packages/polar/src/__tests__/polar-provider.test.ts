import type { Polar } from "@polar-sh/sdk";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPolarProvider, polar } from "../polar-provider";

vi.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: vi.fn(),
  WebhookVerificationError: class WebhookVerificationError extends Error {},
}));

type Page<T> = {
  result: { items: T[] };
  next: () => null;
  [Symbol.asyncIterator]: () => AsyncIterableIterator<Page<T>>;
};

function page<T>(items: T[]): Page<T> {
  const result: Page<T> = {
    result: { items },
    next: () => null,
    [Symbol.asyncIterator]: async function* iterator() {
      yield result;
    },
  };
  return result;
}

function httpValidationError(): HTTPValidationError {
  return new HTTPValidationError(
    { detail: [{ loc: ["body", "email"], msg: "already exists", type: "value_error" }] },
    {
      body: "{}",
      request: new Request("https://api.polar.sh/v1/customers/"),
      response: new Response("{}", { status: 422 }),
    },
  );
}

describe("@paykitjs/polar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a provider config with createAdapter", () => {
    const config = polar({
      accessToken: "polar_test_123",
      webhookSecret: "whsec_test_123",
      server: "sandbox",
    });

    expect(config.id).toBe("polar");
    expect(config.name).toBe("Polar");
    expect(config.capabilities.testClocks).toBe(false);
    expect(typeof config.createAdapter).toBe("function");
  });

  it("includes subscription data on successful checkout webhooks", async () => {
    const subscriptions = {
      get: vi.fn().mockResolvedValue({
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentPeriodEnd: "2026-06-01T00:00:00.000Z",
        currentPeriodStart: "2026-05-01T00:00:00.000Z",
        endedAt: null,
        id: "sub_123",
        productId: "prod_123",
        status: "active",
      }),
    };
    const client = { subscriptions } as unknown as Polar;
    vi.mocked(validateEvent).mockReturnValue({
      type: "checkout.updated",
      data: {
        id: "chk_123",
        customerId: "cus_123",
        metadata: {
          paykit_customer_id: "customer_123",
          paykit_intent: "subscribe",
          paykit_plan_id: "pro",
        },
        status: "succeeded",
        subscriptionId: "sub_123",
      },
    } as unknown as ReturnType<typeof validateEvent>);

    const provider = createPolarProvider(client, {
      accessToken: "polar_test_123",
      webhookSecret: "whsec_test_123",
    });

    const events = await provider.handleWebhook({
      body: "{}",
      headers: { "webhook-id": "evt_123" },
    });

    expect(subscriptions.get).toHaveBeenCalledWith({ id: "sub_123" });
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      checkoutSessionId: "chk_123",
      providerCustomerId: "cus_123",
      providerEventId: "evt_123",
      providerSubscriptionId: "sub_123",
      subscription: {
        providerProduct: { productId: "prod_123" },
        providerSubscriptionId: "sub_123",
        status: "active",
      },
    });
  });

  it("re-links an existing customer when Polar rejects a duplicate", async () => {
    const existingCustomer = {
      id: "cus_existing",
      email: "person@example.com",
      externalId: null,
      metadata: { existing: "value" },
    };
    const customers = {
      create: vi.fn().mockRejectedValue(httpValidationError()),
      list: vi.fn().mockResolvedValue(page([existingCustomer])),
      update: vi.fn().mockResolvedValue({ id: "cus_existing" }),
    };
    const client = { customers } as unknown as Polar;
    const provider = createPolarProvider(client, {
      accessToken: "polar_test_123",
      webhookSecret: "whsec_test_123",
    });

    const result = await provider.createCustomer({
      id: "paykit_customer_123",
      email: "person@example.com",
      name: "Person",
      metadata: { plan: "pro" },
    });

    expect(result.providerCustomer.id).toBe("cus_existing");
    expect(customers.list).toHaveBeenCalledWith({ email: "person@example.com", limit: 1 });
    expect(customers.update).toHaveBeenCalledWith({
      id: "cus_existing",
      customerUpdate: {
        name: "Person",
        metadata: {
          existing: "value",
          paykitCustomerId: "paykit_customer_123",
          plan: "pro",
        },
      },
    });
  });

  it("only archives PayKit-managed orphan products during sync", async () => {
    const products = {
      create: vi.fn(),
      list: vi.fn().mockResolvedValue(
        page([
          {
            id: "prod_existing",
            metadata: { paykitProductId: "basic" },
            recurringInterval: "month",
          },
          {
            id: "prod_unmanaged",
            metadata: {},
            recurringInterval: "month",
          },
          {
            id: "prod_orphan",
            metadata: { paykitProductId: "old" },
            recurringInterval: "month",
          },
        ]),
      ),
      update: vi.fn().mockImplementation(({ id, productUpdate }) =>
        Promise.resolve({
          id,
          metadata: productUpdate.metadata ?? {},
          recurringInterval: "month",
        }),
      ),
    };
    const organizations = {
      list: vi.fn().mockResolvedValue({ result: { items: [] } }),
    };
    const client = { organizations, products } as unknown as Polar;
    const provider = createPolarProvider(client, {
      accessToken: "polar_test_123",
      webhookSecret: "whsec_test_123",
    });

    const result = await provider.syncProducts({
      products: [
        {
          id: "basic",
          name: "Basic",
          priceAmount: 1000,
          priceInterval: "month",
          existingProviderProduct: { productId: "prod_existing" },
        },
      ],
    });

    expect(result.results).toEqual([
      { id: "basic", providerProduct: { productId: "prod_existing" } },
    ]);
    expect(products.create).not.toHaveBeenCalled();
    expect(products.update).toHaveBeenCalledWith({
      id: "prod_existing",
      productUpdate: expect.objectContaining({
        metadata: { paykitProductId: "basic" },
        name: "Basic",
      }),
    });
    expect(products.update).toHaveBeenCalledWith({
      id: "prod_orphan",
      productUpdate: { isArchived: true },
    });
    expect(products.update).not.toHaveBeenCalledWith({
      id: "prod_unmanaged",
      productUpdate: { isArchived: true },
    });
  });
});
