"use client";

import { Check, Loader2, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { CreemLogo, PolarLogo, StripeLogo } from "@/components/landing/provider-logos";
import { Section, SectionContent } from "@/components/layout/section";
import { cn } from "@/lib/utils";

// ─── Step wrapper with vertical connector ────────────────────────────

function Step({
  number,
  title,
  description,
  last,
  children,
}: {
  number: number;
  title: string;
  description: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex gap-6 lg:gap-10">
      {/* Step indicator + vertical line */}
      <div className="hidden flex-col items-center pt-1 sm:flex">
        <div className="border-foreground/[0.15] text-foreground/40 flex size-8 shrink-0 items-center justify-center border font-mono text-xs">
          {number}
        </div>
        {!last && <div className="bg-foreground/[0.08] w-px flex-1" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", !last && "pb-12 lg:pb-16")}>
        <div className="mb-5 space-y-1.5">
          <div className="text-foreground/40 font-mono text-xs sm:hidden">
            {String(number).padStart(2, "0")}
          </div>
          <h3 className="text-foreground/90 text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h3>
          <p className="text-foreground/45 max-w-lg text-sm leading-relaxed">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Preview pane wrapper ────────────────────────────────────────────

function PreviewPane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-foreground/[0.06] border border-dashed">
      <div className="border-foreground/[0.06] text-foreground/30 flex items-center border-b border-dashed px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ─── Step 1: Provider selector ───────────────────────────────────────

const providers = [
  { id: "stripe", logo: <StripeLogo className="h-5" /> },
  { id: "polar", logo: <PolarLogo className="h-5.5" /> },
  { id: "creem", logo: <CreemLogo className="h-4.5" /> },
] as const;

type ProviderId = (typeof providers)[number]["id"];

function ProviderStep({ codeBlocks }: { codeBlocks: Record<ProviderId, ReactNode> }) {
  const [active, setActive] = useState<ProviderId>("stripe");

  return (
    <div className="flex flex-col gap-4">
      {/* Provider pills */}
      <div className="flex items-center gap-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setActive(provider.id)}
            className={cn(
              "border px-4 py-2.5 transition-all",
              active === provider.id
                ? "border-foreground/[0.15] bg-foreground/[0.04] text-foreground/90"
                : "border-foreground/[0.06] text-foreground/25 hover:text-foreground/45 hover:border-foreground/[0.1]",
            )}
          >
            {provider.logo}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="border-foreground/[0.1] overflow-hidden border">
        <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2">
          <span className="text-foreground/50 text-[13px]">paykit.ts</span>
        </div>
        {providers.map((p) => (
          <div key={p.id} className={active === p.id ? "block" : "hidden"}>
            {codeBlocks[p.id]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Subscribe ───────────────────────────────────────────────

const plans = [
  { id: "free" as const, name: "Free", price: "$0", interval: "", features: ["50 messages/mo"] },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$19",
    interval: "/mo",
    features: ["2,000 messages/mo", "Pro models", "Priority support"],
  },
];

type PlanId = "free" | "pro";

function SubscribeStep({ codeBlock }: { codeBlock: ReactNode }) {
  const [activePlan, setActivePlan] = useState<PlanId>("free");
  const [transitioning, setTransitioning] = useState(false);

  const handleSubscribe = useCallback(
    (planId: PlanId) => {
      if (planId === activePlan || transitioning) return;
      setTransitioning(true);
      setTimeout(() => {
        setActivePlan(planId);
        setTransitioning(false);
      }, 800);
    },
    [activePlan, transitioning],
  );

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
      {/* Code */}
      <div className="border-foreground/[0.1] min-w-0 flex-1 overflow-hidden border">
        <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2">
          <span className="text-foreground/50 text-[13px]">billing.ts</span>
        </div>
        {codeBlock}
      </div>

      {/* Preview */}
      <div className="shrink-0 lg:w-[260px]">
        <PreviewPane label="Your pricing page">
          <div className="flex flex-col gap-2">
            {plans.map((plan) => {
              const isActive = activePlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "border p-3 transition-all",
                    isActive
                      ? "border-foreground/[0.15] bg-foreground/[0.02]"
                      : "border-foreground/[0.06]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/80 text-xs font-semibold">{plan.name}</span>
                    <span className="text-foreground/50 text-xs">
                      {plan.price}
                      <span className="text-foreground/30">{plan.interval}</span>
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-foreground/35 flex items-center gap-1.5 text-[10px]"
                      >
                        <Check className="size-2.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={isActive || transitioning}
                    onClick={() => handleSubscribe(plan.id)}
                    className={cn(
                      "mt-2.5 flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-all",
                      isActive
                        ? "border-foreground/[0.06] text-foreground/25 border"
                        : "bg-foreground text-background hover:opacity-90",
                    )}
                  >
                    {transitioning && !isActive ? (
                      <>
                        <Loader2 className="size-2.5 animate-spin" />
                        Checkout...
                      </>
                    ) : isActive ? (
                      "Current"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </PreviewPane>
      </div>
    </div>
  );
}

// ─── Step 3: Check & Report ──────────────────────────────────────────

const LIMIT = 50;
const INITIAL_USED = 46;

const initialMessages = [
  { role: "user" as const, text: "How do I add billing to my app?" },
  {
    role: "assistant" as const,
    text: "Use PayKit — define plans in code, call subscribe(). It handles Stripe and webhooks.",
  },
  { role: "user" as const, text: "Does it support usage limits?" },
  {
    role: "assistant" as const,
    text: "Yes! Use check() and report() to enforce metered features.",
  },
];

const autoReplies = [
  "All billing state writes to your Postgres — queryable with SQL.",
  "Swap providers by changing one import. Logic stays the same.",
  "Dashboard mounts at /paykit. No separate service.",
  "Upgrades switch immediately, downgrades at end of cycle.",
];

function CheckReportStep({ codeBlock }: { codeBlock: ReactNode }) {
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
    <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
      {/* Code */}
      <div className="border-foreground/[0.1] min-w-0 flex-1 overflow-hidden border">
        <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2">
          <span className="text-foreground/50 text-[13px]">api/chat/route.ts</span>
        </div>
        {codeBlock}
      </div>

      {/* Preview — chat */}
      <div className="shrink-0 lg:w-[260px]">
        <PreviewPane label="Your app">
          <div className="flex flex-col">
            {/* Chat header */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground/50 text-[10px] font-medium">AI Chat</span>
              <span
                className={cn(
                  "font-mono text-[10px]",
                  blocked ? "text-red-500" : "text-foreground/30",
                )}
              >
                {remaining}/{LIMIT}
              </span>
            </div>

            {/* Messages */}
            <div className="flex h-[200px] flex-col gap-1.5 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[90%] px-2.5 py-1.5 text-[10px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-foreground/[0.05] text-foreground/60 self-end"
                      : "bg-foreground/[0.02] text-foreground/45 self-start",
                  )}
                >
                  {msg.text}
                </div>
              ))}
              {typing && (
                <div className="bg-foreground/[0.02] text-foreground/30 self-start px-2.5 py-1.5 text-[10px]">
                  ...
                </div>
              )}
              {blocked && (
                <div className="mt-1 self-center px-2.5 py-1.5 text-center text-[10px] text-red-500/70">
                  Limit reached. Upgrade to Pro.
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-foreground/[0.06] mt-2 flex items-center gap-1.5 border-t pt-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                disabled={blocked}
                placeholder={blocked ? "Upgrade to continue..." : "Send a message..."}
                className="text-foreground placeholder:text-foreground/20 min-w-0 flex-1 bg-transparent text-[10px] outline-none disabled:opacity-40"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={blocked || !input.trim()}
                className="text-foreground/30 hover:text-foreground/50 disabled:opacity-20"
              >
                <Send className="size-3" />
              </button>
            </div>
          </div>
        </PreviewPane>
      </div>
    </div>
  );
}

// ─── Main section ────────────────────────────────────────────────────

export function HowItWorksSection({
  providerCodeBlocks,
  subscribeCodeBlock,
  checkReportCodeBlock,
}: {
  providerCodeBlocks: Record<ProviderId, ReactNode>;
  subscribeCodeBlock: ReactNode;
  checkReportCodeBlock: ReactNode;
}) {
  return (
    <Section className="py-12 lg:py-20">
      <div className="mb-10 lg:mb-14">
        <h2 className="text-foreground/90 text-xl font-semibold tracking-tight sm:text-2xl">
          How it works
        </h2>
      </div>

      <Step
        number={1}
        title="Bring your provider"
        description="Connect Stripe, Polar, or Creem. Your billing logic stays the same — swap providers by changing one import."
      >
        <ProviderStep codeBlocks={providerCodeBlocks} />
      </Step>

      <Step
        number={2}
        title="Subscribe customers"
        description="One call for new subscriptions, upgrades, and downgrades. PayKit handles checkout sessions and webhook state internally."
      >
        <SubscribeStep codeBlock={subscribeCodeBlock} />
      </Step>

      <Step
        number={3}
        title="Enforce limits"
        description="Gate features with check(), track usage with report(). Two lines to add metered billing to any endpoint."
        last
      >
        <CheckReportStep codeBlock={checkReportCodeBlock} />
      </Step>
    </Section>
  );
}
