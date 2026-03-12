import type { PayKitInstance } from "../../types/instance";

interface NextRouteContext {
  params?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function extractProviderId(
  request: Request,
  context?: NextRouteContext,
): Promise<string | null> {
  if (context?.params) {
    const params = await context.params;
    const providerId = params.providerId;
    if (typeof providerId === "string") {
      return providerId;
    }

    if (Array.isArray(providerId) && providerId.length > 0) {
      return providerId[providerId.length - 1] ?? null;
    }

    const slug = params.slug;
    if (typeof slug === "string") {
      return slug;
    }

    if (Array.isArray(slug) && slug.length > 0) {
      return slug[slug.length - 1] ?? null;
    }

    const firstParam = Object.values(params).find(
      (value): value is string | string[] => typeof value === "string" || Array.isArray(value),
    );
    if (typeof firstParam === "string") {
      return firstParam;
    }

    if (Array.isArray(firstParam) && firstParam.length > 0) {
      return firstParam[firstParam.length - 1] ?? null;
    }
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  return segments[segments.length - 1] ?? null;
}

async function parseBody(request: Request): Promise<string> {
  return request.text();
}

export function paykitHandler(paykit: Pick<PayKitInstance, "handleWebhook">): {
  GET: (request: Request, context?: NextRouteContext) => Promise<Response>;
  POST: (request: Request, context?: NextRouteContext) => Promise<Response>;
} {
  const handle = async (request: Request, context?: NextRouteContext): Promise<Response> => {
    const providerId = await extractProviderId(request, context);
    if (!providerId) {
      return Response.json(
        {
          code: "INVALID_WEBHOOK_PROVIDER",
          message: "Missing provider ID in route",
        },
        { status: 400 },
      );
    }

    const body = await parseBody(request);
    const headers = headersToRecord(request.headers);

    try {
      const result = await paykit.handleWebhook({
        providerId,
        body,
        headers,
      });
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook failed";
      return Response.json(
        {
          code: "WEBHOOK_FAILED",
          message,
        },
        { status: 400 },
      );
    }
  };

  return {
    GET: handle,
    POST: handle,
  };
}
