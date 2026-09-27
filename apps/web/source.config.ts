import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins/rehype-code";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { shikiThemes } from "./src/lib/shiki-themes";

export const docs = defineDocs({
  dir: "./content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        stringify(node, _parent, state, info) {
          if (
            node.type === "mdxJsxFlowElement" &&
            (node.name === "Features" || node.name === "FeatureCard")
          ) {
            return state.containerFlow(node, info);
          }
        },
      },
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
