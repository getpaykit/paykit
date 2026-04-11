import type { IncomingMessage } from "node:http";

import type { PayKitInstance } from "../types/instance";

interface FastifyRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  raw: IncomingMessage;
}

interface FastifyReply {
  status: (code: number) => FastifyReply;
  headers: (headers: Record<string, string>) => FastifyReply;
  send: (payload: unknown) => FastifyReply;
}

function toWebRequest(request: FastifyRequest): Request {
  const proto = request.headers["x-forwarded-proto"] ?? "http";
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url, `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers,
    body: hasBody ? (request.raw as unknown as ReadableStream) : null,
    // @ts-expect-error -- Node 22+ supports duplex on Request init
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeWebResponse(webResponse: Response, reply: FastifyReply): Promise<void> {
  const responseHeaders: Record<string, string> = {};
  webResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  reply.status(webResponse.status).headers(responseHeaders);

  if (!webResponse.body) {
    reply.send("");
    return;
  }

  const body = new Uint8Array(await webResponse.arrayBuffer());
  reply.send(Buffer.from(body));
}

export function paykitHandler(
  paykit: Pick<PayKitInstance, "handler">,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    const webRequest = toWebRequest(request);
    const webResponse = await paykit.handler(webRequest);
    await writeWebResponse(webResponse, reply);
  };
}
