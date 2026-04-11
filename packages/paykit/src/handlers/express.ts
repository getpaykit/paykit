import type { IncomingMessage, ServerResponse } from "node:http";

import type { PayKitInstance } from "../types/instance";

function toWebRequest(req: IncomingMessage): Request {
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : null,
    // @ts-expect-error -- Node 22+ supports duplex on Request init
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeWebResponse(webResponse: Response, res: ServerResponse): Promise<void> {
  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));

  if (!webResponse.body) {
    res.end();
    return;
  }

  const reader = webResponse.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

export function paykitHandler(
  paykit: Pick<PayKitInstance, "handler">,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const webRequest = toWebRequest(req);
    const webResponse = await paykit.handler(webRequest);
    await writeWebResponse(webResponse, res);
  };
}
