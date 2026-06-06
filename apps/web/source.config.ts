import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins/rehype-code";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { shikiThemes } from "./src/lib/shiki-themes";

export const docs = defineDocs({
  dir: "./content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: shikiThemes,
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        {
          pre(node) {
            node.properties["data-language"] = this.options.lang;
          },
        },
      ],
    },
  },
});
