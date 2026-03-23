import { PayKitError } from "../core/errors";
import type { PayKitInstance } from "../types/instance";

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function paykitHandler(paykit: Pick<PayKitInstance, "handleWebhook">): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
} {
  const handle = async (request: Request): Promise<Response> => {
    const body = await request.text();
    const headers = headersToRecord(request.headers);

    try {
      const result = await paykit.handleWebhook({ body, headers });
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook failed";
      if (error instanceof PayKitError) {
        return Response.json({ code: error.code, message }, { status: 400 });
      }
      return Response.json({ code: "WEBHOOK_FAILED", message }, { status: 500 });
    }
  };

  return {
    GET: handle,
    POST: handle,
  };
}
