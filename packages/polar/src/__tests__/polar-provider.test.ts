import { describe, expect, it, vi } from "vitest";

const polarSdkMock = vi.hoisted(() => ({
  client: null as unknown,
  Polar: vi.fn(function Polar() {
    return polarSdkMock.client;
  }),
}));

vi.mock("@polar-sh/sdk", () => ({
  Polar: polarSdkMock.Polar,
}));

import { polar } from "../polar-provider";

function createProvider(client: unknown) {
  polarSdkMock.client = client;
  return polar({
    accessToken: "polar_test_123",
    server: "sandbox",
    webhookSecret: "whsec_123",
  });
}

describe("@paykitjs/polar", () => {
  it("manages webhook endpoints", async () => {
    const createWebhookEndpoint = vi.fn().mockResolvedValue({
      id: "webhook_123",
      secret: "whsec_created",
    });
    const client = {
      organizations: {
        list: vi.fn().mockResolvedValue({ result: { items: [{ id: "org_123", name: "Acme" }] } }),
      },
      webhooks: {
        createWebhookEndpoint,
      },
    };
    const provider = createProvider(client);

    const account = await provider.getWebhookEndpointAccount?.();
    const endpoint = await provider.ensureWebhookEndpoint?.({ url: "https://example.com/webhook" });

    expect(provider.capabilities.manageWebhookEndpoints).toBe(true);
    expect(account).toEqual({
      displayName: "Acme",
      environment: "sandbox",
      providerAccountId: "org_123",
      providerId: "polar",
    });
    expect(createWebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "raw",
        name: "PayKit",
        url: "https://example.com/webhook",
      }),
    );
    expect(createWebhookEndpoint).toHaveBeenCalledWith(
      expect.not.objectContaining({ organizationId: expect.any(String) }),
    );
    expect(endpoint).toEqual({
      created: true,
      endpointId: "webhook_123",
      webhookSecret: "whsec_created",
    });
  });

  it("updates an existing webhook endpoint", async () => {
    const updateWebhookEndpoint = vi.fn().mockResolvedValue({ id: "webhook_existing" });
    const provider = createProvider({
      webhooks: {
        updateWebhookEndpoint,
      },
    });

    const endpoint = await provider.ensureWebhookEndpoint?.({
      existingEndpointId: "webhook_existing",
      url: "https://example.com/webhook",
    });

    expect(updateWebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "webhook_existing",
        webhookEndpointUpdate: expect.objectContaining({
          enabled: true,
          format: "raw",
          name: "PayKit",
          url: "https://example.com/webhook",
        }),
      }),
    );
    expect(endpoint).toEqual({
      created: false,
      endpointId: "webhook_existing",
      webhookSecret: "whsec_123",
    });
  });
});
