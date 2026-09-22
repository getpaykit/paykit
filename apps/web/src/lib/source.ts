import type { InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import type { DocData, DocMethods } from "fumadocs-mdx/runtime/types";
import { docs } from "fumadocs-mdx:collections/server";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export type SourcePage = InferPageType<typeof source> & {
  data: InferPageType<typeof source>["data"] & DocData & DocMethods & { full?: boolean };
};
