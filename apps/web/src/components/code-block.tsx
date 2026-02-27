"use client";

import { Check, Copy } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import type * as React from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

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
  language?: string;
  filename?: string;
  className?: string;
}

function CodeBlock({
  code,
  language = "typescript",
  filename,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lineCount = code.split("\n").length;

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
        <button
          type="button"
          onClick={copyToClipboard}
          className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-transparent transition-colors hover:bg-white/[0.06]"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
        </button>
      </div>

      {/* Code area */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-start px-4 py-4">
          <div
            aria-hidden="true"
            className="select-none pr-4 text-right font-mono text-xs leading-relaxed text-slate-600/60"
          >
            {Array.from({ length: lineCount }).map((_, index) => (
              <div key={index}>{(index + 1).toString().padStart(2, "0")}</div>
            ))}
          </div>

          <Highlight
            code={code}
            language={language}
            theme={{
              ...themes.synthwave84,
              plain: { backgroundColor: "transparent" },
            }}
          >
            {({
              className: hlClassName,
              style,
              tokens,
              getLineProps,
              getTokenProps,
            }) => (
              <pre
                className={cn(
                  "flex-1 pl-4 border-l border-white/[0.04] font-mono text-[13px] leading-relaxed whitespace-pre",
                  hlClassName,
                )}
                style={style}
              >
                <code>
                  {tokens.map((line, lineIndex) => (
                    <div key={lineIndex} {...getLineProps({ line })}>
                      {line.map((token, tokenIndex) => (
                        <span key={tokenIndex} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </code>
              </pre>
            )}
          </Highlight>
        </div>
      </div>
    </div>
  );
}

export { CodeBlock };
