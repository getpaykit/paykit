import { highlight } from "fumadocs-core/highlight";
import type { HighlightOptions } from "fumadocs-core/highlight";
import type { ComponentProps } from "react";
import type { BundledTheme } from "shiki";

import { CodeBlock, type CodeBlockProps, Pre } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
const defaultThemes = {
  themes: {
    light: "github-light" satisfies BundledTheme,
    dark: "one-dark-pro" satisfies BundledTheme,
  },
};

const defaultCodeBlockProps: CodeBlockProps = {
  className:
    "border-0 my-0 shadow-none bg-neutral-50 dark:bg-background [&_div]:bg-neutral-50 [&_div]:dark:bg-background",
  keepBackground: true,
  "data-line-numbers": true,
  viewportProps: {
    className: "overflow-x-auto overflow-y-visible max-h-none",
  },
};

function createPre(codeblock: CodeBlockProps, allowCopy: boolean) {
  return function HighlightedPre(props: ComponentProps<"pre">) {
    return (
      <CodeBlock
        {...props}
        {...codeblock}
        allowCopy={allowCopy}
        className={cn("my-0 border-t-0", props.className, codeblock.className)}
      >
        <Pre className="py-2">{props.children}</Pre>
      </CodeBlock>
    );
  };
}

export async function InlineCode({ lang, code }: { lang: string; code: string }) {
  const { codeToHtml } = await import("shiki");
  const html = await codeToHtml(code, {
    lang,
    theme: "one-dark-pro",
  });

  // Extract just the inner spans from <pre><code><span class="line">...</span></code></pre>
  const innerHtml = html
    .replace(/<pre[^>]*>/, "")
    .replace(/<\/pre>/, "")
    .replace(/<code[^>]*>/, "")
    .replace(/<\/code>/, "")
    .replace(/<span class="line">/, "")
    .replace(/<\/span>$/, "")
    .replace(/background-color:[^;"]*;?/g, "");

  return (
    <span
      className="font-mono text-[11px] leading-none whitespace-nowrap"
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  );
}

export async function CodeBlockContent({
  lang,
  code,
  codeblock,
  options,
  allowCopy = true,
}: {
  lang: string;
  code: string;
  codeblock?: CodeBlockProps;
  allowCopy?: boolean;
  options?: Omit<HighlightOptions, "lang">;
}) {
  const merged = { ...defaultCodeBlockProps, ...codeblock };

  const highlighted = await highlight(code, {
    lang,
    ...defaultThemes,
    ...options,
    components: {
      pre: createPre(merged, allowCopy),
      ...options?.components,
    },
  } satisfies HighlightOptions);

  return highlighted;
}
