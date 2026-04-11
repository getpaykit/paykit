import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { paykitHandler } from "../express";

function createMockPayKit(
  handler: (request: Request) => Promise<Response>,
): Pick<{ handler: (request: Request) => Promise<Response> }, "handler"> {
  return { handler };
}

describe("express handler", () => {
  const paykit = createMockPayKit(async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/paykit/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/paykit/api/echo" && request.method === "POST") {
      const body = await request.json();
      return new Response(JSON.stringify({ echo: body }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  });

  const handler = paykitHandler(paykit);
  let baseUrl: string;
  const server = createServer(handler);

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("handles GET requests", async () => {
    const res = await fetch(`${baseUrl}/paykit/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("handles POST requests with JSON body", async () => {
    const res = await fetch(`${baseUrl}/paykit/api/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.echo).toEqual({ message: "hello" });
  });

  it("forwards response status codes", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  it("forwards response headers", async () => {
    const res = await fetch(`${baseUrl}/paykit/api/health`);
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("forwards request headers to paykit.handler", async () => {
    const pk = createMockPayKit(async (request) => {
      const auth = request.headers.get("authorization");
      return new Response(JSON.stringify({ auth }), { status: 200 });
    });
    const h = paykitHandler(pk);
    const s = createServer(h);

    await new Promise<void>((resolve) => s.listen(0, () => resolve()));
    const addr = s.address() as AddressInfo;

    try {
      const res = await fetch(`http://localhost:${addr.port}/test`, {
        headers: { authorization: "Bearer token123" },
      });
      const data = await res.json();
      expect(data.auth).toBe("Bearer token123");
    } finally {
      await new Promise<void>((resolve, reject) => {
        s.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
