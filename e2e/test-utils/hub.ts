import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const HUB_PORT = 4567;
export const HUB_REGISTER_URL = `http://127.0.0.1:${String(HUB_PORT)}/_hub/register`;
export const HUB_UNREGISTER_URL = `http://127.0.0.1:${String(HUB_PORT)}/_hub/unregister`;

/** Events that arrive for an unknown customer are buffered for this long. */
const BUFFER_TTL_MS = 60_000;

interface BufferedEvent {
  body: string;
  headers: Record<string, string>;
  path: string;
  receivedAt: number;
}

/**
 * Extract the provider customer ID from provider webhook bodies.
 * Returns null for events that aren't keyed by customer (e.g. product.created).
 */
function extractProviderCustomerId(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      data?: {
        customer?: { id?: string | null } | null;
        customerId?: string | null;
        customer_id?: string | null;
        object?: { id?: string; customer?: string | null; object?: string };
      };
    };

    if (typeof parsed.data?.customerId === "string") {
      return parsed.data.customerId;
    }
    if (typeof parsed.data?.customer_id === "string") {
      return parsed.data.customer_id;
    }
    if (typeof parsed.data?.customer?.id === "string") {
      return parsed.data.customer.id;
    }

    const obj = parsed.data?.object;
    if (!obj) return null;
    if (obj.object === "customer" && typeof obj.id === "string") return obj.id;
    if (typeof obj.customer === "string") return obj.customer;
    return null;
  } catch {
    return null;
  }
}

async function forwardEvent(workerUrl: string, event: BufferedEvent): Promise<Response> {
  const url = new URL(event.path, workerUrl);
  return fetch(url, { method: "POST", headers: event.headers, body: event.body });
}

export function startHub(): Promise<Server> {
  const registry = new Map<string, string>();
  const buffers = new Map<string, BufferedEvent[]>();

  function dropExpired(customerId: string): void {
    const buf = buffers.get(customerId);
    if (!buf) return;
    const now = Date.now();
    const kept = buf.filter((e) => now - e.receivedAt < BUFFER_TTL_MS);
    if (kept.length === 0) buffers.delete(customerId);
    else buffers.set(customerId, kept);
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString();
    const path = req.url ?? "/";

    if (path === "/_hub/register") {
      const { providerCustomerId, workerUrl } = JSON.parse(body) as {
        providerCustomerId: string;
        workerUrl: string;
      };
      registry.set(providerCustomerId, workerUrl);
      // Drain any buffered events for this customer
      dropExpired(providerCustomerId);
      const pending = buffers.get(providerCustomerId) ?? [];
      buffers.delete(providerCustomerId);
      for (const event of pending) {
        await forwardEvent(workerUrl, event).catch(() => {});
      }
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === "/_hub/unregister") {
      const { providerCustomerIds } = JSON.parse(body) as { providerCustomerIds: string[] };
      for (const id of providerCustomerIds) {
        registry.delete(id);
        buffers.delete(id);
      }
      res.writeHead(204);
      res.end();
      return;
    }

    // Otherwise: route webhook by customer ID
    const customerId = extractProviderCustomerId(body);
    if (!customerId) {
      // No customer → setup artifacts (product.created, price.created). Drop.
      res.writeHead(204);
      res.end();
      return;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers[key] = value;
    }

    const workerUrl = registry.get(customerId);
    if (!workerUrl) {
      // Unknown customer — buffer briefly in case a worker is about to register.
      const buf = buffers.get(customerId) ?? [];
      buf.push({ body, headers, path, receivedAt: Date.now() });
      buffers.set(customerId, buf);
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const response = await forwardEvent(workerUrl, {
        body,
        headers,
        path,
        receivedAt: Date.now(),
      });
      res.writeHead(response.status);
      res.end(await response.text());
    } catch (error) {
      res.writeHead(500);
      res.end(error instanceof Error ? error.message : "hub forward error");
    }
  });

  return new Promise<Server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(HUB_PORT, "127.0.0.1", () => resolve(server));
  });
}

export async function registerCustomer(
  providerCustomerId: string,
  workerUrl: string,
): Promise<void> {
  const response = await fetch(HUB_REGISTER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerCustomerId, workerUrl }),
  });
  if (!response.ok) throw new Error(`hub register failed: ${String(response.status)}`);
}

export async function unregisterCustomers(providerCustomerIds: string[]): Promise<void> {
  if (providerCustomerIds.length === 0) return;
  await fetch(HUB_UNREGISTER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerCustomerIds }),
  }).catch(() => {});
}

/** Vitest globalSetup entry — starts the hub once and returns a teardown. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  let server: Server;
  try {
    server = await startHub();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new Error(
        `Hub port ${String(HUB_PORT)} already in use. Kill any stale webhook server before running tests.`,
        { cause: error },
      );
    }
    throw error;
  }
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
