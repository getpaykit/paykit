"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef, FormEvent, KeyboardEvent } from "react";
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import {
  RiChat3Fill,
  RiCloseLine,
  RiLoader4Line,
  RiRefreshLine,
  RiRobot2Line,
  RiSearchLine,
  RiSendPlane2Line,
} from "react-icons/ri";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { DefaultPre } from "@/components/docs/package-command";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DynamicCodeBlock } from "@/components/ui/dynamic-code-block";
import { cn } from "@/lib/utils";

const suggestions = [
  "How do I define plans and features?",
  "How do entitlements work?",
  "How should I report metered usage?",
];

type DocsChatState = ReturnType<typeof useChat>;

function MarkdownLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  if (href?.startsWith("/docs")) {
    return (
      <Link href={href} className="font-medium underline underline-offset-3" {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className="font-medium underline underline-offset-3"
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}

function AssistantPre({ children }: ComponentPropsWithoutRef<"pre">) {
  const child = Children.toArray(children)[0];
  if (
    !isValidElement<{ children?: unknown; className?: string }>(child) ||
    typeof child.props.children !== "string"
  ) {
    return (
      <div className="my-4 min-w-0 max-w-full [&>.docs-codeblock]:mt-0">
        <DefaultPre>{children}</DefaultPre>
      </div>
    );
  }

  const language =
    child.props.className
      ?.split(" ")
      .find((value) => value.startsWith("language-"))
      ?.slice("language-".length) ?? "text";

  return (
    <div className="my-4 min-w-0 max-w-full [&>.docs-codeblock]:mt-0">
      <DynamicCodeBlock
        code={child.props.children.trimEnd()}
        lang={language === "mdx" ? "md" : language}
        options={{ components: { pre: DefaultPre } }}
      />
    </div>
  );
}

function AssistantMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: MarkdownLink,
        blockquote: ({ children: quote }) => (
          <blockquote className="my-4 border-l-2 pl-3 text-muted-foreground">{quote}</blockquote>
        ),
        code: ({ className, children: code, ...props }) =>
          className?.startsWith("language-") ? (
            <code className={className} {...props}>
              {code}
            </code>
          ) : (
            <code
              className="rounded-sm border bg-muted px-1 py-0.5 font-mono text-[0.78em]"
              {...props}
            >
              {code}
            </code>
          ),
        h1: ({ children: heading }) => (
          <h1 className="mt-5 mb-2 text-base font-medium first:mt-0">{heading}</h1>
        ),
        h2: ({ children: heading }) => (
          <h2 className="mt-5 mb-2 text-sm font-medium first:mt-0">{heading}</h2>
        ),
        h3: ({ children: heading }) => (
          <h3 className="mt-4 mb-2 text-sm font-medium first:mt-0">{heading}</h3>
        ),
        li: ({ children: item }) => <li className="pl-0.5">{item}</li>,
        ol: ({ children: list }) => <ol className="my-3 ml-5 list-decimal space-y-1.5">{list}</ol>,
        p: ({ children: paragraph }) => (
          <p className="my-2.5 leading-relaxed first:mt-0 last:mb-0">{paragraph}</p>
        ),
        pre: AssistantPre,
        table: ({ children: table }) => (
          <div className="my-4 max-w-full overflow-x-auto rounded-sm border">
            <table className="w-full text-left text-xs">{table}</table>
          </div>
        ),
        td: ({ children: cell }) => <td className="border-t px-2 py-1.5">{cell}</td>,
        th: ({ children: cell }) => <th className="bg-muted/60 px-2 py-1.5 font-medium">{cell}</th>,
        ul: ({ children: list }) => <ul className="my-3 ml-5 list-disc space-y-1.5">{list}</ul>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function getSearchResultCount(output: unknown) {
  return Array.isArray(output) ? output.length : undefined;
}

function getSearchStates(message: UIMessage) {
  const seenQueries = new Set<string>();

  return message.parts.flatMap((part) => {
    if (part.type !== "tool-search" || typeof part !== "object") return [];

    const record = part as unknown as Record<string, unknown>;
    const input = record.input as Record<string, unknown> | undefined;
    const query = typeof input?.query === "string" ? input.query : "search";
    if (seenQueries.has(query)) return [];
    seenQueries.add(query);

    const state = typeof record.state === "string" ? record.state : "";
    const failed = state === "output-error" || state === "output-denied";
    const complete = state === "output-available";
    const resultCount = complete ? getSearchResultCount(record.output) : undefined;

    return [
      {
        failed,
        key: typeof record.toolCallId === "string" ? record.toolCallId : query,
        label: failed
          ? "Failed to search documentation"
          : complete
            ? resultCount === undefined
              ? "Searched PayKit docs"
              : `${resultCount} search results`
            : "Searching…",
      },
    ];
  });
}

function normalizeDocsPath(value: unknown) {
  if (typeof value !== "string") return undefined;
  const pathname = value.split(/[?#]/, 1)[0];
  return pathname === "/docs" || pathname?.startsWith("/docs/") ? pathname : undefined;
}

function getReferences(markdown: string) {
  const references = new Map<string, { title: string; url: string }>();

  const linkPattern = /\[([^\]]+)]\((\/docs(?:\/[^\s)#?]+)?)(?:[?#][^)]*)?\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const url = normalizeDocsPath(match[2]);
    if (url && !references.has(url)) references.set(url, { title: match[1]!, url });
  }

  return [...references.values()];
}

function AssistantMessage({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const searchStates = getSearchStates(message);
  const references = text ? getReferences(text) : [];

  if (message.role === "assistant" && !text && searchStates.length === 0) return null;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <p
        className={cn(
          "mb-1 text-sm font-medium",
          message.role === "assistant" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {message.role === "assistant" ? "PayKit" : "You"}
      </p>
      {text ? (
        <div className="min-w-0 max-w-full overflow-x-hidden break-words text-sm leading-6 text-foreground/85">
          <AssistantMarkdown>{text}</AssistantMarkdown>
        </div>
      ) : null}
      {searchStates.map((tool) => (
        <div
          key={tool.key}
          className={cn(
            "mt-2 flex items-center gap-1.5 rounded-sm border bg-secondary/60 px-2 py-1.5 text-xs text-muted-foreground",
            tool.failed && "text-destructive",
          )}
        >
          {tool.failed ? (
            <RiCloseLine className="size-3.5" />
          ) : (
            <RiSearchLine className="size-3.5" />
          )}
          {tool.label}
        </div>
      ))}
      {references.length > 0 ? (
        <div className="mt-3 flex flex-row flex-wrap items-center gap-1">
          {references.map((reference, index) => (
            <Link
              key={reference.url}
              className="block min-w-0 max-w-full rounded-sm border p-3 text-xs break-words transition-colors hover:bg-accent hover:text-accent-foreground"
              href={reference.url}
            >
              <p className="font-medium">{reference.title}</p>
              <p className="text-muted-foreground">Reference {index + 1}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatPanel({ chat, onClose }: { chat: DocsChatState; onClose: () => void }) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const followOutputRef = useRef(true);
  const { error, messages, regenerate, sendMessage, setMessages, status, stop } = chat;
  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    if (!followOutputRef.current) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, status]);

  function submitMessage(value: string) {
    const text = value.trim();
    if (!text || busy) return;
    followOutputRef.current = true;
    void sendMessage({ role: "user", parts: [{ type: "text", text }] });
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitMessage(input);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(input);
    }
  }

  return (
    <section
      className="flex size-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-background p-2 lg:p-3"
      aria-label="AI Assistant"
    >
      <header className="sticky top-0 flex items-start gap-2 rounded-sm border bg-secondary/60 text-secondary-foreground shadow-sm">
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="mb-2 text-sm font-medium">AI Assistant</p>
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a
              className="underline underline-offset-3 hover:text-foreground"
              href="https://fumadocs.dev"
              rel="noreferrer"
              target="_blank"
            >
              Fumadocs
            </a>
          </p>
        </div>
        <Button
          aria-label="Close AI Assistant"
          className="m-1 size-7 text-muted-foreground"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <RiCloseLine />
        </Button>
      </header>

      <div
        ref={listRef}
        aria-live="polite"
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain py-4 [mask-image:linear-gradient(to_bottom,transparent,white_1rem,white_calc(100%-1rem),transparent_100%)]"
        onScroll={(event) => {
          const element = event.currentTarget;
          followOutputRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-2 px-3 py-8 text-center text-sm text-muted-foreground/80">
            <RiChat3Fill className="size-5" />
            <p>Start a new chat below, or choose a question.</p>
            <div className="mt-3 flex w-full flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-sm border bg-secondary/40 px-2.5 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-secondary"
                  onClick={() => submitMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 max-w-full flex-col gap-6 px-3">
            {messages
              .filter((message) => message.role !== "system")
              .map((message) => (
                <AssistantMessage key={message.id} message={message} />
              ))}
            {error ? (
              <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {error.message || "The request failed."}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-sm border bg-secondary/60 text-secondary-foreground shadow-sm has-focus-within:shadow-md">
        <form className="flex items-start gap-2 pr-2" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            aria-label="Ask a PayKit documentation question"
            autoFocus
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent p-3 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={busy ? "PayKit is answering…" : "Ask a question"}
            rows={1}
            value={input}
          />
          {busy ? (
            <Button
              aria-label="Stop answer"
              className="mt-2"
              onClick={stop}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RiLoader4Line className="animate-spin" />
              Abort Answer
            </Button>
          ) : (
            <Button
              aria-label="Send question"
              className="mt-2"
              disabled={!input.trim()}
              size="icon-sm"
              type="submit"
            >
              <RiSendPlane2Line />
            </Button>
          )}
        </form>
        {messages.length > 0 ? (
          <div className="flex items-center gap-1.5 p-1 pt-0">
            {!busy && (error || messages.at(-1)?.role === "assistant") ? (
              <Button size="sm" type="button" variant="secondary" onClick={() => regenerate()}>
                <RiRefreshLine />
                Retry
              </Button>
            ) : null}
            <Button
              disabled={busy}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setMessages([])}
            >
              Clear Chat
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DocsAssistant({
  desktop,
  onOpenChange,
  open,
}: {
  desktop: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const pathname = usePathname();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
          const recentMessages = messages.slice(-20);
          if (recentMessages[0]?.role === "assistant") recentMessages.shift();

          return {
            body: { currentPage: pathname, messageId, messages: recentMessages, trigger },
          };
        },
      }),
    [pathname],
  );
  const chat = useChat({
    id: "paykit-docs-assistant",
    transport,
  });

  return (
    <>
      <Button
        aria-keyshortcuts="Control+/ Meta+/"
        aria-label="Open PayKit Assistant"
        inert={open}
        tabIndex={open ? -1 : undefined}
        className={cn(
          "fixed right-4 bottom-4 z-40 gap-1.5 border shadow-md transition-[opacity,translate]",
          open && "pointer-events-none translate-y-2 opacity-0",
        )}
        onClick={() => onOpenChange(true)}
        size="sm"
        type="button"
        variant="secondary"
      >
        <RiRobot2Line />
        Ask AI
      </Button>

      {open && desktop ? (
        <aside className="sticky top-0 h-dvh w-(--fd-assistant-width) overflow-hidden border-x bg-background [grid-area:toc]">
          <ChatPanel chat={chat} onClose={() => onOpenChange(false)} />
        </aside>
      ) : null}

      <Dialog open={open && !desktop} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-4 right-2 bottom-4 left-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-md border bg-background p-0 ring-0 sm:max-w-none"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>AI Assistant</DialogTitle>
            <DialogDescription>Ask questions about the PayKit documentation.</DialogDescription>
          </DialogHeader>
          <ChatPanel chat={chat} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
