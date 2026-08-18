"use client";

import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { RiArrowDownSLine } from "react-icons/ri";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Anchor, InlineCode } from "@/components/docs/mdx-text";
import { DynamicCodeBlock } from "@/components/ui/dynamic-code-block";
import type { ChangelogRelease } from "@/lib/changelog";
import { cn } from "@/lib/utils";

function ReleaseBody({ content, expandable }: Pick<ChangelogRelease, "content" | "expandable">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    if (expanded) {
      const release = containerRef.current?.closest("article");
      setExpanded(false);
      requestAnimationFrame(() => release?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }

    setExpanded(true);
  }

  if (!content) {
    return <p className="text-foreground/45 text-sm">No release notes were provided.</p>;
  }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <div className={cn("max-w-3xl", expandable && !expanded && "max-h-100 overflow-hidden")}>
          <ReleaseMarkdown content={content} />
        </div>
        {expandable && !expanded && (
          <div className="from-background via-background/90 pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t to-transparent" />
        )}
      </div>

      {expandable && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={toggleExpanded}
          className="text-muted-foreground hover:text-foreground mt-10 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          <RiArrowDownSLine
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Collapse release" : "Expand release"}
        </button>
      )}
    </div>
  );
}

function ReleaseMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => <Anchor {...props} target="_blank" rel="noopener noreferrer" />,
        blockquote: (props) => (
          <blockquote
            {...props}
            className="text-muted-foreground mt-6 border-l-2 pl-6 text-sm italic"
          />
        ),
        code: ({ className, ...props }) =>
          className?.includes("language-") ? (
            <code {...props} className={className} />
          ) : (
            <InlineCode {...props} className={className} />
          ),
        h2: (props) => (
          <h2
            {...props}
            className="font-heading text-primary mt-8 mb-4 scroll-m-10 text-xl font-medium tracking-tight first:mt-0"
          />
        ),
        h3: (props) => (
          <h3
            {...props}
            className="font-heading text-primary mt-8 mb-4 scroll-m-10 text-base font-medium tracking-tight first:mt-0"
          />
        ),
        hr: () => null,
        li: (props) => (
          <li {...props} className="text-muted-foreground mt-2 text-sm leading-relaxed" />
        ),
        ol: (props) => <ol {...props} className="my-4 ml-4 list-decimal in-[ol]:my-2" />,
        p: (props) => (
          <p {...props} className="text-muted-foreground my-4 text-sm leading-relaxed" />
        ),
        pre: ({ children }) => {
          const codeElement = children as ReactElement<{
            children?: string;
            className?: string;
          }>;
          const language = codeElement?.props.className?.replace("language-", "") || "text";
          const code =
            typeof codeElement?.props.children === "string"
              ? codeElement.props.children.trim()
              : "";

          return (
            <DynamicCodeBlock
              lang={language}
              code={code}
              codeblock={{ className: "my-4 rounded-xs shadow-none" }}
            />
          );
        },
        strong: (props) => <strong {...props} className="text-foreground font-medium" />,
        table: (props) => (
          <div className="no-scrollbar my-6 w-full overflow-y-auto rounded-sm border">
            <table
              {...props}
              className="relative w-full overflow-hidden border-none text-sm [&_tbody_tr:last-child]:border-b-0"
            />
          </div>
        ),
        td: (props) => <td {...props} className="px-4 py-2 text-left whitespace-nowrap" />,
        th: (props) => <th {...props} className="px-4 py-2 text-left font-medium" />,
        tr: (props) => <tr {...props} className="m-0 border-b" />,
        ul: (props) => <ul {...props} className="my-4 ml-4 list-disc in-[ul]:my-2" />,
      }}
    >
      {content}
    </Markdown>
  );
}

function ContributorAvatar({ username }: { username: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <a
      href={`https://github.com/${username}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`@${username}`}
      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={`https://github.com/${username}.png?size=48`}
        alt={`@${username}`}
        width={24}
        height={24}
        loading="lazy"
        onError={() => setFailed(true)}
        className="bg-background size-6 rounded-full border opacity-90 shadow-sm transition-opacity hover:opacity-100"
      />
    </a>
  );
}

function Contributors({ usernames }: { usernames: string[] }) {
  if (usernames.length === 0) return null;

  return (
    <div className="max-w-3xl">
      <h3 className="font-heading text-primary mt-8 mb-4 text-base font-medium tracking-tight">
        Contributors
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Thanks to everyone who contributed to this release.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {usernames.map((username) => (
          <ContributorAvatar key={username} username={username} />
        ))}
      </div>
    </div>
  );
}

export function ChangelogContent({ releases }: { releases: ChangelogRelease[] }) {
  if (releases.length === 0) {
    return (
      <div className="px-5 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-foreground/50 text-sm">Release notes are temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {releases.map((release) => (
        <article
          key={release.id}
          id={release.tag}
          className="border-border scroll-mt-16 border-b border-dashed px-5 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14"
        >
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2>
                <a
                  href={release.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/90 hover:text-foreground text-2xl font-medium tracking-tight transition-colors"
                >
                  {release.title || release.tag}
                </a>
              </h2>
              {release.title !== release.tag && (
                <span className="bg-muted text-muted-foreground rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                  {release.tag}
                </span>
              )}
              <time className="text-muted-foreground font-mono text-xs tracking-tight">
                {release.date}
              </time>
            </div>

            <ReleaseBody content={release.content} expandable={release.expandable} />
            <Contributors usernames={release.contributors} />
          </div>
        </article>
      ))}
    </div>
  );
}
