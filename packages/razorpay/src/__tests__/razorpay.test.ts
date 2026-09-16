import { PAYKIT_ERROR_CODES } from "paykitjs";
import { describe, expect, it, vi } from "vitest";

import { createRazorpayProvider } from "../razorpay-provider";

describe("providers/razorpay", () => {
  it("creates a customer and syncs name/email", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cust_123" });
    const edit = vi.fn().mockResolvedValue({});

    const provider = createRazorpayProvider(
      {
        customers: { create, edit },
      } as never,
      {
        keyId: "rzp_test_123",
        keySecret: "secret_test_123",
        webhookSecret: "whsec_123",
      },
    );

    const result = await provider.createCustomer({
      email: "test@example.com",
      id: "pk_123",
      metadata: { role: "tester" },
      name: "Tester",
    });

    expect(create).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Tester",
      notes: {
        paykitCustomerId: "pk_123",
        role: "tester",
      },
      fail_existing: 0,
    });
    expect(edit).toHaveBeenCalledWith("cust_123", {
      email: "test@example.com",
      name: "Tester",
    });
    expect(result).toEqual({ providerCustomer: { id: "cust_123" } });
  });

  it("throws a clear error when email is missing", async () => {
    const provider = createRazorpayProvider(
      {
        customers: { create: vi.fn(), edit: vi.fn() },
      } as never,
      {
        keyId: "rzp_test_123",
        keySecret: "secret_test_123",
        webhookSecret: "whsec_123",
      },
    );

    await expect(
      provider.createCustomer({
        id: "pk_123",
      }),
    ).rejects.toMatchObject({
      code: PAYKIT_ERROR_CODES.CUSTOMER_CREATE_FAILED.code,
    });
  });

  it("returns a check payload with sample customers", async () => {
    const provider = createRazorpayProvider(
      {
        webhooks: {
          all: vi.fn().mockResolvedValue({
            items: [{ url: "https://example.com/webhook", active: true }],
          }),
        },
        customers: {
          all: vi.fn().mockResolvedValue({
            items: [{ email: "test@example.com", notes: { paykitCustomerId: "pk_123" } }],
          }),
        },
      } as never,
      {
        keyId: "rzp_test_123",
        keySecret: "secret_test_123",
        webhookSecret: "whsec_123",
      },
    );

    const result = await provider.check?.();

    expect(result).toEqual({
      ok: true,
      displayName: "Razorpay",
      mode: "test mode",
      webhookEndpoints: [{ url: "https://example.com/webhook", status: "active" }],
      customerSample: [{ providerEmail: "test@example.com", paykitCustomerId: "pk_123" }],
    });
  });
});
