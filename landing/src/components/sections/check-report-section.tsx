"use client";

import { Send } from "lucide-react";
import { useCallback, useState } from "react";

import { SectionContainer } from "@/components/layout/section-container";
import { cn } from "@/lib/utils";

const LIMIT = 50;
const INITIAL_USED = 46;

const initialMessages = [
  { role: "user" as const, text: "How do I add billing to my app?" },
  {
    role: "assistant" as const,
    text: "You can use PayKit — define plans in code and call paykit.subscribe(). It handles Stripe, webhooks, and entitlements for you.",
  },
  { role: "user" as const, text: "Does it support usage limits?" },
  {
    role: "assistant" as const,
    text: 'Yes! Define metered features with feature({ type: "metered" }), then use paykit.check() and paykit.report() to enforce and track usage.',
  },
];

const autoReplies = [
  "PayKit writes all billing state to your Postgres — paykit_* tables, queryable with SQL.",
  "You can swap providers by changing one import. Your billing logic stays the same.",
  "The embedded dashboard mounts at /paykit in your app. No separate service needed.",
  "Upgrades switch immediately, downgrades apply at end of cycle. All automatic.",
];

export function CheckReportSection({ codeBlock }: { codeBlock: React.ReactNode }) {
  const [messages, setMessages] = useState(initialMessages);
  const [used, setUsed] = useState(INITIAL_USED);
  const [input, setInput] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [typing, setTyping] = useState(false);

  const remaining = LIMIT - used;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || blocked || typing) return;

    const newUsed = used + 1;
    setMessages((prev) => [...prev, { role: "user" as const, text }]);
    setInput("");
    setUsed(newUsed);

    if (newUsed >= LIMIT) {
      setBlocked(true);
      return;
    }

    setTyping(true);
    setTimeout(() => {
      const reply =
        autoReplies[(newUsed - INITIAL_USED - 1) % autoReplies.length] ?? autoReplies[0]!;
      setMessages((prev) => [...prev, { role: "assistant" as const, text: reply }]);
      setUsed((u) => u + 1);
      setTyping(false);

      if (newUsed + 1 >= LIMIT) {
        setBlocked(true);
      }
    }, 600);
  }, [input, blocked, typing, used]);

  return (
    <SectionContainer className="py-12 lg:py-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        {/* Left — code */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-800 sm:text-xl dark:text-neutral-200">
              Enforce limits
            </h2>
            <p className="text-foreground/50 max-w-md text-sm leading-relaxed sm:text-base">
              Gate features with{" "}
              <code className="text-foreground/70 text-[13px]">paykit.check()</code> and track usage
              with <code className="text-foreground/70 text-[13px]">paykit.report()</code>. Two
              lines to add metered billing.
            </p>
          </div>
          <div className="border-foreground/[0.1] overflow-hidden border">
            <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2">
              <span className="text-foreground/50 text-[13px]">api/chat/route.ts</span>
            </div>
            {codeBlock}
          </div>
        </div>

        {/* Right — interactive chat demo */}
        <div className="border-foreground/[0.08] flex shrink-0 flex-col border lg:w-[340px]">
          {/* Header */}
          <div className="border-foreground/[0.08] flex items-center justify-between border-b px-4 py-3">
            <span className="text-foreground/70 text-sm font-medium">AI Chat</span>
            <span
              className={cn("font-mono text-xs", blocked ? "text-red-500" : "text-foreground/40")}
            >
              {remaining}/{LIMIT} left
            </span>
          </div>

          {/* Messages */}
          <div className="flex h-[280px] flex-col gap-2.5 overflow-y-auto p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-foreground/[0.06] text-foreground/70 self-end"
                    : "bg-foreground/[0.03] text-foreground/60 self-start",
                )}
              >
                {msg.text}
              </div>
            ))}
            {typing && (
              <div className="bg-foreground/[0.03] text-foreground/40 max-w-[85%] self-start px-3 py-2 text-xs">
                Typing...
              </div>
            )}
            {blocked && (
              <div className="border-red-500/20 bg-red-500/[0.05] self-center border px-3 py-2 text-center text-xs text-red-500">
                Message limit reached. Upgrade to Pro.
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-foreground/[0.08] flex items-center gap-2 border-t px-3 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              disabled={blocked}
              placeholder={blocked ? "Upgrade to continue..." : "Type a message..."}
              className="text-foreground placeholder:text-foreground/30 min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={blocked || !input.trim()}
              className="text-foreground/40 hover:text-foreground/70 disabled:opacity-30"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
