import { createFromSource } from "fumadocs-core/search/server";
import type { InferPageType } from "fumadocs-core/source";
import { llms, loader } from "fumadocs-core/source";
import type { DocData, DocMethods } from "fumadocs-mdx/runtime/types";
import { docs } from "fumadocs-mdx:collections/server";

import { getLLMText } from "@/lib/get-llm-text";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const docsLlms = llms(source, { renderPage: getLLMText });
export const docsSearch = createFromSource(source);

export type SourcePage = InferPageType<typeof source> & {
  data: InferPageType<typeof source>["data"] & DocData & DocMethods & { full?: boolean };
};
