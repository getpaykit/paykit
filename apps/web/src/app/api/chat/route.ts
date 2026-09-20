import { env } from "@/env";
import {
  DocsChatRequestTooLargeError,
  DocsChatValidationError,
  parseDocsChatRequest,
  readDocsChatRequest,
} from "@/lib/docs-chat-request";

export const maxDuration = 60;

function chatError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function streamWithInactivityTimeout(
  body: ReadableStream<Uint8Array>,
  upstreamController: AbortController,
) {
  const reader = body.getReader();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clearInactivityTimeout = () => clearTimeout(timeout);
  const resetInactivityTimeout = () => {
    clearInactivityTimeout();
    timeout = setTimeout(() => upstreamController.abort(), 30_000);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      resetInactivityTimeout();
      try {
        const { done, value } = await reader.read();
        if (done) {
          clearInactivityTimeout();
          controller.close();
          return;
        }

        controller.enqueue(value);
        resetInactivityTimeout();
      } catch (error) {
        clearInactivityTimeout();
        controller.error(error);
      }
    },
    async cancel(reason) {
      clearInactivityTimeout();
      upstreamController.abort(reason);
      await reader.cancel(reason);
    },
  });
}

export async function POST(request: Request) {
  let body: ReturnType<typeof parseDocsChatRequest>;

  try {
    body = parseDocsChatRequest(await readDocsChatRequest(request));
  } catch (error) {
    const message =
      error instanceof DocsChatValidationError || error instanceof DocsChatRequestTooLargeError
        ? error.message
        : "The chat request is invalid.";
    return chatError(message, error instanceof DocsChatRequestTooLargeError ? 413 : 400);
  }

  let upstream: Response;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 30_000);

  try {
    upstream = await fetch(env.MASTRA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MASTRA_CHAT_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, timeoutController.signal]),
    });
  } catch {
    return chatError("The PayKit assistant is temporarily unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || !upstream.body) {
    const status =
      !upstream.ok && upstream.status !== 401 && upstream.status !== 403 ? upstream.status : 502;
    return chatError("The PayKit assistant could not complete this request.", status);
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream; charset=utf-8",
  });
  const streamVersion = upstream.headers.get("x-vercel-ai-ui-message-stream");
  if (streamVersion) headers.set("x-vercel-ai-ui-message-stream", streamVersion);

  return new Response(streamWithInactivityTimeout(upstream.body, timeoutController), {
    status: 200,
    headers,
  });
}
