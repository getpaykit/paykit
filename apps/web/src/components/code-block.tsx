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
  className?: string;
}

function CodeBlock({
  code,
  language = "typescript",
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
        "relative overflow-hidden rounded-sm bg-gradient-to-tr from-stone-950/90 via-black to-black/90 ring-1 ring-white/10",
        className,
      )}
    >
      <div className="pl-4 pt-4">
        <TrafficLightsIcon className="h-2.5 w-auto stroke-slate-500/30" />

        <div className="relative flex flex-col items-start text-sm">
          <div className="absolute top-2 right-4 z-10">
            <button
              type="button"
              onClick={copyToClipboard}
              className="flex h-5 w-5 items-center justify-center border-none bg-transparent"
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="h-3 w-3 text-stone-300" />
              ) : (
                <Copy className="h-3 w-3 text-slate-500" />
              )}
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="relative flex min-w-max items-start px-1 py-4">
              <div
                aria-hidden="true"
                className="select-none border-r border-slate-300/5 pr-4 font-mono text-xs leading-relaxed text-slate-600"
              >
                {Array.from({ length: lineCount }).map((_, index) => (
                  <div key={index}>
                    {(index + 1).toString().padStart(2, "0")}
                  </div>
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
                      "flex-1 px-4 font-mono text-sm leading-relaxed whitespace-pre",
                      hlClassName,
                    )}
                    style={style}
                  >
                    <code>
                      {tokens.map((line, lineIndex) => (
                        <div key={lineIndex} {...getLineProps({ line })}>
                          {line.map((token, tokenIndex) => (
                            <span
                              key={tokenIndex}
                              {...getTokenProps({ token })}
                            />
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
      </div>
    </div>
  );
}

export { CodeBlock };
