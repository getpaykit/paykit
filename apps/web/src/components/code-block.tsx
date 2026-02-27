import type * as React from "react";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  lineCount?: number;
}

function CodeBlock({ children, className, lineCount }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "border border-border overflow-hidden bg-gradient-to-tr from-zinc-950 via-black to-zinc-900 ring-1 ring-white/10",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
        <div className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
        <div className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
        <div className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
      </div>

      {/* Code area */}
      <div className="flex overflow-x-auto">
        {/* Line numbers */}
        {lineCount !== undefined && lineCount > 0 && (
          <div
            className="select-none shrink-0 border-r border-border px-4 py-6 text-right text-xs leading-relaxed text-zinc-600 font-mono"
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{String(i + 1).padStart(2, "0")}</div>
            ))}
          </div>
        )}

        <pre className="flex-1 p-6 text-sm leading-relaxed">
          <code className="font-mono">{children}</code>
        </pre>
      </div>
    </div>
  );
}

// Token helpers for syntax highlighting without a runtime library.
// These are intentionally not exported — consumers build code as JSX.
const t = {
  kw: (s: string) => <span className="text-sky-400">{s}</span>,
  str: (s: string) => <span className="text-amber-300">{s}</span>,
  fn: (s: string) => <span className="text-violet-400">{s}</span>,
  prop: (s: string) => <span className="text-zinc-300">{s}</span>,
  comment: (s: string) => <span className="text-zinc-500">{s}</span>,
  plain: (s: string) => <span className="text-zinc-400">{s}</span>,
  type: (s: string) => <span className="text-emerald-400">{s}</span>,
};

export { CodeBlock, t };
