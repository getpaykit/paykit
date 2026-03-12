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

export interface HighlightedCodeBlockProps {
  lang: string;
  code: string;
  codeblock?: CodeBlockProps;
  allowCopy?: boolean;
  options?: Omit<HighlightOptions, "lang">;
}

function createPre(codeblock: CodeBlockProps | undefined, allowCopy: boolean) {
  return function HighlightedPre(props: ComponentProps<"pre">) {
    return (
      <CodeBlock
        {...props}
        {...codeblock}
        allowCopy={allowCopy}
        className={cn("my-0 border-t-0", props.className, codeblock?.className)}
      >
        <Pre className="py-2">{props.children}</Pre>
      </CodeBlock>
    );
  };
}

export async function HighlightedCodeBlock({
  lang,
  code,
  codeblock,
  options,
  allowCopy = true,
}: HighlightedCodeBlockProps) {
  const highlighted = await highlight(code, {
    lang,
    ...defaultThemes,
    ...options,
    components: {
      pre: createPre(codeblock, allowCopy),
      ...options?.components,
    },
  } satisfies HighlightOptions);

  return highlighted;
}
