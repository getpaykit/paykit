import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { docsSearch } from "@/lib/docs-search";
import { source } from "@/lib/source";

const systemPrompt = [
  "You are the PayKit documentation assistant.",
  "Answer questions about PayKit using the search tool before answering.",
  "Ground answers in the search results and cite relevant pages as Markdown links using their url field.",
  "Be concise and practical. If the documentation does not answer the question, say so.",
].join("\n");

const search = tool({
  description: "Search the PayKit documentation for information relevant to the user's question.",
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).default(6),
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
          content: await page.data.getText("processed"),
          description: page.data.description ?? "",
          title: page.data.title,
          url: page.url,
        };
      }),
    ).then((pages) => pages.filter((page) => page !== null));
  },
});

export async function POST(request: Request) {
  const body = (await request.json()) as { currentPage?: string; messages?: UIMessage[] };
  const currentPage = body.currentPage?.startsWith("/docs") ? body.currentPage : undefined;

  const result = streamText({
    instructions: currentPage
      ? `${systemPrompt}\nThe reader is viewing ${currentPage}.`
      : systemPrompt,
    model: process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.6-luna",
    messages: await convertToModelMessages(body.messages ?? []),
    stopWhen: stepCountIs(4),
    toolChoice: "auto",
    tools: { search },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
