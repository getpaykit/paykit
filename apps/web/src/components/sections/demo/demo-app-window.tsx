"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { RefObject } from "react";
import { RiLoader4Line, RiSendPlaneLine } from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FREE_LIMIT, PRO_LIMIT } from "./demo-types";

function WindowChrome({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-foreground/[0.1] bg-card flex flex-col overflow-hidden rounded-none border shadow-lg",
        className,
      )}
    >
      <div className="border-foreground/[0.06] flex h-9.5 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400/40" />
          <div className="size-2.5 rounded-full bg-yellow-400/40" />
          <div className="size-2.5 rounded-full bg-green-400/40" />
        </div>
        {label}
      </div>
      {children}
    </div>
  );
}

export function DemoAppWindow({
  plan,
  downgradeScheduled,
  busy,
  messages,
  used,
  input,
  limit,
  blocked,
  aiState,
  streamingText,
  upgradeBanner,
  autoTyping,
  chatRef,
  className,
  onInputChange,
  onSend,
  onUpgrade,
  onDowngrade,
  onResubscribe,
  onPortal,
}: {
  plan: "free" | "pro";
  downgradeScheduled: boolean;
  busy: "" | "upgrade" | "downgrade" | "resubscribe";
  messages: { role: "user" | "ai"; text: string }[];
  used: number;
  input: string;
  limit: number;
  blocked: boolean;
  aiState: "idle" | "thinking" | "streaming";
  streamingText: string;
  upgradeBanner: boolean;
  autoTyping: boolean;
  chatRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUpgrade: () => void;
  onDowngrade: () => void;
  onResubscribe: () => void;
  onPortal: () => void;
}) {
  return (
    <WindowChrome
      label={
        <div className="bg-foreground/[0.04] text-foreground/45 flex-1 rounded-md px-3 py-[0.2rem] text-center font-mono text-[11px]">
          localhost:3000
        </div>
      }
      className={className}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="border-foreground/[0.06] flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                plan === "pro"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-foreground/[0.06] text-foreground/40",
              )}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
            {plan === "pro" && (
              <span className="text-foreground/40 text-[11px]">
                {downgradeScheduled ? "Ends" : "Renews"} Apr 28, 2026
              </span>
            )}
          </div>
          <span className="text-foreground/60 text-[13px] font-medium">AI Chat</span>
        </div>

        {/* Billing + chat */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Billing panel — hidden on mobile, sidebar on desktop */}
          <div className="border-foreground/[0.06] hidden shrink-0 flex-col lg:flex lg:w-50 lg:border-r">
            <div className="flex gap-2 px-3 py-3 lg:flex-col">
              <PlanCard
                name="Free"
                price="$0"
                limit={FREE_LIMIT}
                active={plan === "free"}
                variant="free"
              >
                <Button
                  variant="outline"
                  size="xs"
                  disabled={plan === "free" || downgradeScheduled || !!busy}
                  onClick={onDowngrade}
                  className="mt-2 w-full text-[11px]"
                >
                  {busy === "downgrade" ? (
                    <>
                      <RiLoader4Line className="size-2.5 animate-spin" />
                      Downgrading...
                    </>
                  ) : plan === "free" ? (
                    "Current plan"
                  ) : downgradeScheduled ? (
                    "Scheduled"
                  ) : (
                    "Downgrade"
                  )}
                </Button>
              </PlanCard>

              <PlanCard
                name="Pro"
                price="$19/mo"
                limit={PRO_LIMIT}
                active={plan === "pro"}
                variant="pro"
              >
                <Button
                  variant="outline"
                  size="xs"
                  disabled={(plan === "pro" && !downgradeScheduled) || !!busy}
                  onClick={() => {
                    if (downgradeScheduled) onResubscribe();
                    else onUpgrade();
                  }}
                  className={cn(
                    "mt-2 w-full text-[11px]",
                    blocked && plan === "free" && "animate-[shake_0.4s_ease-in-out]",
                  )}
                >
                  {busy === "upgrade" ? (
                    <>
                      <RiLoader4Line className="size-2.5 animate-spin" />
                      Upgrading...
                    </>
                  ) : busy === "resubscribe" ? (
                    <>
                      <RiLoader4Line className="size-2.5 animate-spin" />
                      Resubscribing...
                    </>
                  ) : plan === "pro" && downgradeScheduled ? (
                    "Resubscribe"
                  ) : plan === "pro" ? (
                    "Current plan"
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              </PlanCard>
            </div>

            <div className="hidden px-3 pb-3 lg:block lg:mt-auto lg:pt-3">
              <Button variant="outline" size="xs" onClick={onPortal} className="w-full text-[11px]">
                Manage billing
              </Button>
            </div>
          </div>

          {/* Chat */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={chatRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
              <div className="mt-auto" />
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[80%] rounded-md px-3 py-2 text-[13px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-foreground/[0.06] text-foreground/65 self-end"
                      : "bg-foreground/[0.03] text-foreground/50 self-start",
                  )}
                >
                  {msg.text}
                </div>
              ))}
              {aiState !== "idle" && (
                <div className="bg-foreground/[0.03] text-foreground/50 max-w-[80%] self-start rounded-md px-3 py-2 text-[13px] leading-relaxed">
                  {aiState === "thinking" ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-foreground/45 size-1 animate-bounce rounded-full [animation-delay:0ms]" />
                      <span className="bg-foreground/45 size-1 animate-bounce rounded-full [animation-delay:150ms]" />
                      <span className="bg-foreground/45 size-1 animate-bounce rounded-full [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <>
                      {streamingText}
                      <span className="bg-foreground/40 ml-0.5 inline-block h-3 w-px animate-pulse" />
                    </>
                  )}
                </div>
              )}
              <AnimatePresence mode="wait">
                {blocked && !upgradeBanner && (
                  <motion.div
                    key="blocked"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 self-center rounded-md border border-red-500/15 bg-red-500/[0.04] px-4 py-2 text-center text-[13px] text-red-400"
                  >
                    {plan === "free"
                      ? "Message limit reached. Upgrade to Pro."
                      : "Monthly limit reached."}
                  </motion.div>
                )}
                {upgradeBanner && (
                  <motion.div
                    key="upgraded"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="mt-2 self-center rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-2 text-center text-[13px] text-emerald-500"
                  >
                    Upgraded to Pro! You can keep chatting.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div className="border-foreground/[0.06] flex shrink-0 items-center gap-2.5 border-t px-4 py-3">
              {autoTyping ? (
                <div className="text-foreground min-w-0 flex-1 text-[13px]">
                  {input}
                  <span className="bg-foreground/60 ml-px inline-block h-3.5 w-px animate-pulse" />
                </div>
              ) : (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSend();
                  }}
                  disabled={blocked || aiState !== "idle"}
                  placeholder={blocked ? "Upgrade to continue..." : "Type a message..."}
                  className="text-foreground placeholder:text-foreground/40 min-w-0 flex-1 bg-transparent text-[13px] outline-none disabled:opacity-40"
                />
              )}
              <UsageRing used={used} limit={limit} />
              <button
                type="button"
                onClick={onSend}
                disabled={blocked || aiState !== "idle" || !input.trim()}
                className="text-foreground/35 hover:text-foreground/60 disabled:opacity-20"
              >
                <RiSendPlaneLine className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

function PlanCard({
  name,
  price,
  limit,
  active,
  variant,
  children,
}: {
  name: string;
  price: string;
  limit: number;
  active: boolean;
  variant: "free" | "pro";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col rounded-md border p-2 transition-all",
        active
          ? variant === "pro"
            ? "border-emerald-500/20 bg-emerald-500/[0.03]"
            : "border-foreground/[0.12] bg-foreground/[0.02]"
          : "border-foreground/[0.06]",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-foreground/80 text-[13px] font-semibold">{name}</span>
        <span className="text-foreground/40 text-[11px]">{price}</span>
      </div>
      <span className="text-foreground/45 mt-0.5 text-[11px]">{limit} msg/mo</span>
      {children}
    </div>
  );
}

function UsageRing({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  const ratio = Math.min(1, limit > 0 ? used / limit : 0);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <svg className="size-4 -rotate-90" viewBox="0 0 20 20">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="2"
          className="stroke-foreground/[0.06]"
        />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-foreground/40 transition-all duration-300"
          style={{
            strokeDasharray: `${2 * Math.PI * 8}`,
            strokeDashoffset: `${2 * Math.PI * 8 * (1 - ratio)}`,
          }}
        />
      </svg>
      <span className="text-foreground/40 font-mono text-[11px]">
        {remaining}/{limit}
      </span>
    </div>
  );
}
