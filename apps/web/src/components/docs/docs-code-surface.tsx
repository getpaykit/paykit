import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Renders the styled `<pre>` wrapper used by docs code blocks.
 *
 * @param props - Standard pre props, including `className` and `tabIndex`.
 * Remaining props are spread onto the `<pre>` element. Defaults `tabIndex` to
 * `0` when undefined so code blocks are keyboard focusable.
 */
export function DocsCodeSurface({ className, tabIndex, ...props }: ComponentProps<"pre">) {
  return (
    <pre
      {...props}
      tabIndex={tabIndex ?? 0}
      className={cn(
        className,
        "bg-background w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-none rounded-xs! border px-0 py-3 text-[13px] leading-normal outline-none has-data-highlighted-line:px-0 has-data-line-numbers:px-0 has-data-[slot=tabs]:p-0 [&>code]:flex [&>code]:w-max [&>code]:min-w-full [&>code]:flex-col [&>code]:px-0! [&_.line]:px-3",
      )}
    />
  );
}
