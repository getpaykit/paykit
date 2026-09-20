import { z } from "zod";

const maxMessages = 20;
const maxPartCharacters = 4_000;
const maxRequestBytes = 64 * 1024;
const maxTotalCharacters = 20_000;

const requestSchema = z.object({
  currentPage: z.string().max(512).default("/docs"),
  messageId: z.string().max(128).optional(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        parts: z.array(z.unknown()).max(50),
        role: z.enum(["user", "assistant"]),
      }),
    )
    .min(1)
    .max(maxMessages),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

const textPartSchema = z.object({
  text: z.string().max(maxPartCharacters),
  type: z.literal("text"),
});

export class DocsChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsChatValidationError";
  }
}

export class DocsChatRequestTooLargeError extends Error {
  constructor() {
    super("The chat request is too large.");
    this.name = "DocsChatRequestTooLargeError";
  }
}

export async function readDocsChatRequest(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    throw new DocsChatRequestTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return undefined;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxRequestBytes) {
        await reader.cancel().catch(() => undefined);
        throw new DocsChatRequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function sanitizeCurrentPage(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    throw new DocsChatValidationError("The current documentation page is invalid.");
  }

  const pathname = new URL(value, "https://paykit.sh").pathname;
  if (pathname !== "/docs" && !pathname.startsWith("/docs/")) {
    throw new DocsChatValidationError("The current page must be part of the documentation.");
  }

  return pathname;
}

export function parseDocsChatRequest(input: unknown) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocsChatValidationError("The chat request is invalid.");
  }

  let totalCharacters = 0;
  const messages = parsed.data.messages.reduce<
    Array<{ id: string; role: "user" | "assistant"; parts: [{ type: "text"; text: string }] }>
  >((result, message, index) => {
    const textParts = message.parts.flatMap((part) => {
      const textPart = textPartSchema.safeParse(part);
      if (textPart.success) {
        const text = textPart.data.text.trim();
        if (!text) return [];

        totalCharacters += text.length;
        return [{ ...textPart.data, text }];
      }

      const rawPart =
        part && typeof part === "object" ? (part as { text?: unknown; type?: unknown }) : undefined;
      if (rawPart?.type === "text" && typeof rawPart.text === "string") {
        throw new DocsChatValidationError(
          message.role === "user"
            ? "The message is too long."
            : "The conversation contains an oversized message.",
        );
      }
      if (message.role === "user") {
        throw new DocsChatValidationError("User messages may contain text only.");
      }

      return [];
    });

    if (textParts.length === 0) {
      if (message.role === "user") {
        throw new DocsChatValidationError("Every user message must contain text.");
      }

      const isRegeneratingLastMessage =
        index === parsed.data.messages.length - 1 && parsed.data.trigger === "regenerate-message";
      if (!isRegeneratingLastMessage && result.at(-1)?.role === "user") result.pop();
      return result;
    }

    result.push({
      id: message.id,
      role: message.role,
      parts: [{ type: "text" as const, text: textParts.map((part) => part.text).join("\n") }],
    });
    return result;
  }, []);

  if (!messages.some((message) => message.role === "user")) {
    throw new DocsChatValidationError("The conversation must contain a user message.");
  }

  if (totalCharacters > maxTotalCharacters) {
    throw new DocsChatValidationError("The conversation is too long.");
  }

  return {
    data: { currentPage: sanitizeCurrentPage(parsed.data.currentPage) },
    messages,
    ...(parsed.data.messageId ? { messageId: parsed.data.messageId } : {}),
    ...(parsed.data.trigger ? { trigger: parsed.data.trigger } : {}),
  };
}
