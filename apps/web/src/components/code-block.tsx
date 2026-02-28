import type * as React from "react";
import type { BundledLanguage } from "shiki";
import { codeToTokens } from "shiki";

import { vercelDark } from "@/lib/shiki-vercel-theme";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

function TrafficLightsIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" {...props}>
      <circle cx="5" cy="5" r="4.5" />
      <circle cx="21" cy="5" r="4.5" />
      <circle cx="37" cy="5" r="4.5" />
    </svg>
  );
}

interface CodeBlockProps {
  code: string;
  language?: BundledLanguage;
  filename?: string;
  className?: string;
}

async function CodeBlock({
  code,
  language = "typescript",
  filename,
  className,
}: CodeBlockProps) {
  const { tokens } = await codeToTokens(code, {
    lang: language,
    theme: vercelDark,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-[#0a0a0a] ring-1 ring-white/[0.08] shadow-2xl shadow-black/50",
        className,
      )}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <TrafficLightsIcon className="h-2.5 w-auto stroke-slate-500/30" />
          {filename && (
            <span className="font-mono text-xs text-slate-500">{filename}</span>
          )}
        </div>
        <CopyButton code={code} />
      </div>

      {/* Code area */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-start px-4 py-4">
          <div
            aria-hidden="true"
            className="select-none pr-4 text-right font-mono text-xs leading-relaxed text-slate-600/60"
          >
            {tokens.map((_, index) => (
              <div key={index}>{(index + 1).toString().padStart(2, "0")}</div>
            ))}
          </div>

          <pre className="flex-1 pl-4 border-l border-white/[0.04] font-mono text-[13px] leading-relaxed whitespace-pre">
            <code>
              {tokens.map((line, lineIndex) => (
                <div key={lineIndex}>
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} style={{ color: token.color }}>
                      {token.content}
                    </span>
                  ))}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export { CodeBlock };
