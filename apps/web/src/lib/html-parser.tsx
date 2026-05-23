"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

import { ReleaseContributors } from "@/components/changelog/release-contributors";
import { cn } from "@/lib/utils";

import { extractContributors } from "./releases";

const COLLAPSE_THRESHOLD = 720;

const markdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-foreground/85 mt-8 mb-3 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-foreground/80 mt-6 mb-2 text-base font-semibold">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="text-foreground/55 mt-4 mb-1.5 text-xs font-semibold tracking-wide uppercase">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-foreground/50 mb-3 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="text-foreground/50 mb-4 space-y-1.5 [&>li]:relative [&>li]:pl-4 [&>li]:text-sm [&>li]:leading-relaxed [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:text-foreground/25 [&>li]:before:content-['–'] [&>li]:before:select-none">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="text-foreground/50 marker:text-foreground/25 mb-4 list-decimal space-y-1.5 pl-5 text-sm [&>li]:leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="[&>p]:mb-0">{children}</li>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground/70 hover:text-foreground underline decoration-foreground/25 underline-offset-4 transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="text-foreground/85 font-medium">{children}</strong>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="bg-foreground/6 text-foreground/75 rounded px-1 py-0.5 font-mono text-[0.8em]">
      {children}
    </code>
  ),
  hr: () => <hr className="border-border/60 my-6" />,
} as const;

export function ReleaseBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isCollapsible = body.length > COLLAPSE_THRESHOLD;
  const contributors = extractContributors(body);

  return (
    <div className="flex flex-col">
      <div className="relative">
        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-300 ease-out flex flex-col",
            isCollapsible && !expanded && "max-h-64",
          )}
        >
          <ReactMarkdown
            rehypePlugins={[rehypeRaw, [rehypeSanitize, defaultSchema]]}
            components={markdownComponents}
          >
            {body}
          </ReactMarkdown>

          {contributors.length >= 1 && <ReleaseContributors contributors={contributors} />}
        </div>

        {isCollapsible && !expanded ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {isCollapsible ? (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="text-foreground/45 hover:text-foreground/75 mt-3 h-8 w-fit flex justify-start gap-1.5 px-0 font-mono text-xs tracking-wide"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? "Show less" : "Read full release"}
        </button>
      ) : null}
    </div>
  );
}
