import { env } from "@/env";
import { DocsChatValidationError, parseDocsChatRequest } from "@/lib/docs-chat-request";

export const maxDuration = 60;

function chatError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  let body: ReturnType<typeof parseDocsChatRequest>;

  try {
    body = parseDocsChatRequest(await request.json());
  } catch (error) {
    const message =
      error instanceof DocsChatValidationError ? error.message : "The chat request is invalid.";
    return chatError(message, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(env.MASTRA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MASTRA_CHAT_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return chatError("The PayKit assistant is temporarily unavailable.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return chatError(
      "The PayKit assistant could not complete this request.",
      upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status,
    );
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream; charset=utf-8",
  });
  const streamVersion = upstream.headers.get("x-vercel-ai-ui-message-stream");
  if (streamVersion) headers.set("x-vercel-ai-ui-message-stream", streamVersion);

  return new Response(upstream.body, { status: 200, headers });
}
