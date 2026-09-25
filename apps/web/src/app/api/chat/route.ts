import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";

import { docsSearch } from "@/lib/docs-search";
import { source } from "@/lib/source";

const maxRequestSize = 64_000;
const maxPageContentSize = 8_000;

const requestSchema = z.object({
  currentPage: z
    .string()
    .max(200)
    .regex(/^\/docs(?:\/[\w.-]+)*$/)
    .optional(),
  messages: z.array(z.unknown()).min(1).max(20),
});

const systemPrompt = [
  "You are the PayKit documentation assistant.",
  "Answer questions about PayKit using the search tool before answering.",
  "Ground answers in the search results and cite relevant pages as Markdown links using their url field.",
  "Be concise and practical. If the documentation does not answer the question, say so.",
].join("\n");

const search = tool({
  description: "Search the PayKit documentation for information relevant to the user's question.",
  inputSchema: z.object({
    query: z.string().min(1).max(200),
    limit: z.number().int().min(1).max(6).default(4),
  }),
  async execute({ query, limit }) {
    const results = await docsSearch.search(query, { limit: limit * 4 });
    const urls = [
      ...new Set(
        results.flatMap((result) => {
          const url = result.url.split("#", 1)[0];
          return url ? [url] : [];
        }),
      ),
    ].slice(0, limit);

    return Promise.all(
      urls.map(async (url) => {
        const page = source.getPageByUrl(url);
        if (!page) return null;

        return {
          content: (await page.data.getText("processed")).slice(0, maxPageContentSize),
          description: page.data.description ?? "",
          title: page.data.title,
          url: page.url,
        };
      }),
    ).then((pages) => pages.filter((page) => page !== null));
  },
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestSize) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  const requestText = await request.text();
  if (new TextEncoder().encode(requestText).byteLength > maxRequestSize) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let requestJson: unknown;
  try {
    requestJson = JSON.parse(requestText);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const body = requestSchema.safeParse(requestJson);
  if (!body.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages = await safeValidateUIMessages({ messages: body.data.messages });
  if (!messages.success || messages.data.some((message) => message.role === "system")) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }

  const result = streamText({
    instructions: body.data.currentPage
      ? `${systemPrompt}\nThe reader is viewing ${body.data.currentPage}.`
      : systemPrompt,
    model: process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.6-luna",
    messages: await convertToModelMessages(messages.data),
    maxOutputTokens: 2_000,
    prepareStep: ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? "required" : "auto",
    }),
    stopWhen: stepCountIs(4),
    tools: { search },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
