"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarX,
  CreditCard,
  Database,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  User,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SectionContainer } from "@/components/layout/section-container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Flow card types ─────────────────────────────────────────────────

type SnippetKey = "subscribe" | "check" | "report" | "portal" | "downgrade" | "resubscribe";

type StepIcon =
  | "user"
  | "credit-card"
  | "webhook"
  | "database"
  | "sparkles"
  | "link"
  | "external-link"
  | "calendar-x"
  | "calendar-check"
  | "shield"
  | "shield-alert"
  | "refresh";

type FlowEntry =
  | { type: "code"; snippet: SnippetKey }
  | { type: "step"; icon: StepIcon; label: string; success?: boolean }
  | { type: "pending"; label: string };

type FlowCard = {
  id: string;
  trigger: string;
  entries: FlowEntry[];
};

let cardId = 0;
function nextCardId() {
  return `card-${++cardId}`;
}

const stepIcons: Record<StepIcon, ReactNode> = {
  user: <UserCheck className="size-3 shrink-0" />,
  "credit-card": <CreditCard className="size-3 shrink-0" />,
  webhook: <Webhook className="size-3 shrink-0" />,
  database: <Database className="size-3 shrink-0" />,
  link: <Link2 className="size-3 shrink-0" />,
  "external-link": <ExternalLink className="size-3 shrink-0" />,
  "calendar-x": <CalendarX className="size-3 shrink-0" />,
  "calendar-check": <CalendarCheck className="size-3 shrink-0" />,
  sparkles: <Sparkles className="size-3 shrink-0" />,
  shield: <Shield className="size-3 shrink-0" />,
  "shield-alert": <ShieldAlert className="size-3 shrink-0" />,
  refresh: <RefreshCw className="size-3 shrink-0" />,
};

// ─── Window chrome ───────────────────────────────────────────────────

const WINDOW_HEIGHT = "h-[576px]";

function WindowChrome({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-foreground/[0.1] bg-card flex flex-col overflow-hidden rounded-lg border shadow-lg",
        className,
      )}
    >
      <div className="border-foreground/[0.06] flex h-10 shrink-0 items-center gap-3 border-b px-4">
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

// ─── Flow log ────────────────────────────────────────────────────────

function FlowLog({
  cards,
  snippets,
}: {
  cards: FlowCard[];
  snippets: Record<SnippetKey, ReactNode>;
}) {
  return (
    <div
      className="relative flex h-full flex-col-reverse overflow-hidden p-3"
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 8%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%)",
      }}
    >
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="border-foreground/[0.08] shrink-0 overflow-hidden rounded-md border border-dashed"
            >
              {/* Trigger — card header */}
              <div className="text-foreground/35 border-foreground/[0.06] flex items-center gap-2 border-b border-dashed py-1.5 pr-2 pl-3.5 text-[11px] font-medium">
                <User className="size-3 shrink-0" />
                {card.trigger}
              </div>

              {/* Entries — code lines and steps interleaved */}
              <div className="flex flex-col gap-1 p-2">
                <AnimatePresence initial={false}>
                  {card.entries.map((entry, i) => (
                    <motion.div
                      key={`${card.id}-entry-${i}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      {entry.type === "code" ? (
                        <motion.div
                          initial={{ opacity: 0.5 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="bg-foreground/[0.03] flex items-center overflow-hidden rounded px-2 py-2"
                        >
                          {snippets[entry.snippet]}
                        </motion.div>
                      ) : entry.type === "pending" ? (
                        <div className="flex items-center gap-2 py-0.5 pl-1.5">
                          <Loader2 className="text-foreground/20 size-3 shrink-0 animate-spin" />
                          <span className="text-foreground/25 text-[11px]">{entry.label}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-0.5 pl-1.5">
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              entry.success === false
                                ? "text-red-400"
                                : entry.success === true
                                  ? "text-emerald-500"
                                  : "text-foreground/30",
                            )}
                          >
                            {stepIcons[entry.icon]}
                          </motion.span>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: 0.05 }}
                            className={cn(
                              "text-[11px]",
                              entry.success === false
                                ? "text-red-400/80"
                                : entry.success === true
                                  ? "text-emerald-500/80"
                                  : "text-foreground/45",
                            )}
                          >
                            {entry.label}
                          </motion.span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {cards.length === 0 && (
        <div className="text-foreground/20 flex flex-1 items-center justify-center text-center text-sm">
          Interact with the app to see
          <br />
          what happens behind the scenes
        </div>
      )}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────

const initialMessages: { role: "user" | "ai"; text: string }[] = [];

// Scripted replies — matched to auto-play questions
const scriptedReplies = [
  "Define your plans in code, connect Stripe, and call subscribe(). PayKit handles checkout, webhooks, and state sync automatically.",
  "Yes! Define metered features, then use check() and report() to enforce them.",
];

// Interactive replies — fun, informative, varied
const interactiveReplies = [
  "PayKit writes all billing state to your Postgres. No more Stripe API calls to check subscription status.",
  "Fun fact: upgrades apply immediately, downgrades wait until end of cycle. All automatic.",
  "Your plans are type-safe. Typo a plan ID and TypeScript catches it at build time.",
  "The dashboard mounts at /paykit in your app. No separate service to deploy.",
  "Webhooks are verified and deduplicated in the same DB transaction. No double charges.",
  "You can swap from Stripe to Polar by changing one import. Your billing logic stays identical.",
  "Every entitlement check is a single function call. No complex permission logic needed.",
  "PayKit runs inside your app. It's a library, not a platform. One npm install and you're set.",
];

const FREE_LIMIT = 2;
const PRO_LIMIT = 10;
const INITIAL_USED = 0;

// ─── Main demo section ──────────────────────────────────────────────

export function DemoSection({ snippets }: { snippets: Record<SnippetKey, ReactNode> }) {
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [downgradeScheduled, setDowngradeScheduled] = useState(false);
  const [busy, setBusy] = useState<"" | "upgrade" | "downgrade" | "resubscribe">("");
  const [messages, setMessages] = useState(initialMessages);
  const [used, setUsed] = useState(INITIAL_USED);
  const [input, setInput] = useState("");
  const [aiState, setAiState] = useState<"idle" | "thinking" | "streaming">("idle");
  const [streamingText, setStreamingText] = useState("");
  const [cards, setCards] = useState<FlowCard[]>([]);
  const [upgradeBanner, setUpgradeBanner] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAutoPlayed = useRef(false);
  const usedRef = useRef(INITIAL_USED);
  const limitRef = useRef(FREE_LIMIT);
  const replyCountRef = useRef(0);

  const limit = plan === "pro" ? PRO_LIMIT : FREE_LIMIT;
  const remaining = limit - used;
  const blocked = remaining < 0;

  usedRef.current = used;
  limitRef.current = limit;

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, aiState, streamingText, blocked]);

  const addCard = useCallback((trigger: string): string => {
    const id = nextCardId();
    setCards((prev) => [...prev, { id, trigger, entries: [] }]);
    return id;
  }, []);

  const addEntry = useCallback((cId: string, entry: FlowEntry) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cId ? { ...c, entries: [...c.entries, entry] } : c)),
    );
  }, []);

  const addEntryDelayed = useCallback(
    (cId: string, entry: FlowEntry, delay: number) =>
      new Promise<void>((resolve) => {
        // Show pending loader immediately
        const pendingLabel = entry.type === "step" ? entry.label : "";
        addEntry(cId, { type: "pending", label: pendingLabel });

        setTimeout(() => {
          // Replace pending with final entry
          setCards((prev) =>
            prev.map((c) => {
              if (c.id !== cId) return c;
              const entries = [...c.entries];
              // Find last pending entry and replace it
              let pendingIdx = -1;
              for (let j = entries.length - 1; j >= 0; j--) {
                if (entries[j]?.type === "pending") {
                  pendingIdx = j;
                  break;
                }
              }
              if (pendingIdx !== -1) {
                entries[pendingIdx] = entry;
              } else {
                entries.push(entry);
              }
              return { ...c, entries };
            }),
          );
          resolve();
        }, delay);
      }),
    [addEntry],
  );

  const streamReply = useCallback(
    (text: string, onStreamStart?: () => void) =>
      new Promise<void>((resolve) => {
        setAiState("thinking");

        setTimeout(() => {
          setAiState("streaming");
          setStreamingText("");
          onStreamStart?.();

          let i = 0;
          const interval = setInterval(() => {
            i++;
            setStreamingText(text.slice(0, i));
            if (i >= text.length) {
              clearInterval(interval);
              // Finalize: add to messages, clear streaming
              setTimeout(() => {
                setMessages((prev) => [...prev, { role: "ai" as const, text }]);
                setAiState("idle");
                setStreamingText("");
                resolve();
              }, 100);
            }
          }, 8);
        }, 600);
      }),
    [],
  );

  // ── Upgrade flow ──────────────────────────────────────────────────

  const handleUpgrade = useCallback(async () => {
    if (busy || plan === "pro") return;
    setBusy("upgrade");

    const cId = addCard("Clicked Upgrade to Pro");
    addEntry(cId, { type: "code", snippet: "subscribe" });

    await addEntryDelayed(
      cId,
      { type: "step", icon: "user", label: "Customer synced with Stripe" },
      400,
    );
    await addEntryDelayed(
      cId,
      { type: "step", icon: "credit-card", label: "Subscription created" },
      500,
    );
    await addEntryDelayed(
      cId,
      { type: "step", icon: "external-link", label: "Checkout session ready" },
      400,
    );
    await addEntryDelayed(cId, { type: "step", icon: "webhook", label: "Webhook received" }, 600);
    await addEntryDelayed(
      cId,
      { type: "step", icon: "database", label: "Billing state saved to DB" },
      300,
    );
    await addEntryDelayed(
      cId,
      {
        type: "step",
        icon: "sparkles",
        label: `Entitlements updated · ${PRO_LIMIT} msg/mo`,
        success: true,
      },
      300,
    );

    setPlan("pro");
    setDowngradeScheduled(false);
    setUsed(0);
    setUpgradeBanner(true);
    setBusy("");
  }, [busy, plan, addCard, addEntry, addEntryDelayed]);

  // ── Downgrade flow ────────────────────────────────────────────────

  const handleDowngrade = useCallback(async () => {
    if (plan !== "pro" || downgradeScheduled || busy) return;
    setBusy("downgrade");

    const cId = addCard("Clicked Downgrade");
    addEntry(cId, { type: "code", snippet: "downgrade" });

    await addEntryDelayed(
      cId,
      { type: "step", icon: "calendar-x", label: "Downgrade scheduled for end of period" },
      400,
    );
    await addEntryDelayed(
      cId,
      { type: "step", icon: "database", label: "Schedule saved to DB", success: true },
      300,
    );

    setDowngradeScheduled(true);
    setBusy("");
  }, [plan, downgradeScheduled, busy, addCard, addEntry, addEntryDelayed]);

  // ── Resubscribe flow ──────────────────────────────────────────────

  const handleResubscribe = useCallback(async () => {
    if (!downgradeScheduled || busy) return;
    setBusy("resubscribe");

    const cId = addCard("Clicked Re-subscribe");
    addEntry(cId, { type: "code", snippet: "resubscribe" });

    await addEntryDelayed(
      cId,
      { type: "step", icon: "calendar-check", label: "Scheduled downgrade canceled" },
      400,
    );
    await addEntryDelayed(
      cId,
      { type: "step", icon: "database", label: "State updated in DB", success: true },
      300,
    );

    setDowngradeScheduled(false);
    setBusy("");
  }, [downgradeScheduled, busy, addCard, addEntry, addEntryDelayed]);

  // ── Send message flow (check → respond → report) ─────────────────

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || blocked || aiState !== "idle") return;

    setMessages((prev) => [...prev, { role: "user" as const, text }]);
    setInput("");
    if (upgradeBanner) setUpgradeBanner(false);

    const newUsed = used + 1;
    const newRemaining = limit - newUsed;

    const cId = addCard("Sent a message");
    addEntry(cId, { type: "code", snippet: "check" });

    if (newRemaining < 0) {
      addEntry(cId, {
        type: "step",
        icon: "shield-alert",
        label: "allowed: false · limit reached",
        success: false,
      });
      setUsed(newUsed);
      return;
    }

    // Check passed
    setTimeout(() => {
      addEntry(cId, {
        type: "step",
        icon: "shield",
        label: `allowed: true · ${newRemaining} remaining`,
      });
    }, 350);

    // AI responds with streaming + report fires when streaming starts
    const idx = replyCountRef.current++;
    const reply = interactiveReplies[idx % interactiveReplies.length]!;
    void streamReply(reply, () => {
      addEntry(cId, { type: "code", snippet: "report" });
      setTimeout(() => {
        addEntry(cId, {
          type: "step",
          icon: "refresh",
          label: `Usage recorded · ${newRemaining}/${limit}`,
        });
      }, 200);
      setUsed(newUsed);
    });
  }, [input, blocked, aiState, used, limit, upgradeBanner, addCard, addEntry, streamReply]);

  // ── Portal flow ───────────────────────────────────────────────────

  const handlePortal = useCallback(async () => {
    const cId = addCard("Clicked Manage billing");
    addEntry(cId, { type: "code", snippet: "portal" });

    await addEntryDelayed(cId, { type: "step", icon: "user", label: "Customer verified" }, 400);
    await addEntryDelayed(
      cId,
      { type: "step", icon: "link", label: "Portal session created" },
      500,
    );
    await addEntryDelayed(
      cId,
      { type: "step", icon: "external-link", label: "Redirect URL ready", success: true },
      300,
    );
  }, [addCard, addEntry, addEntryDelayed]);

  // ── Auto-play helpers ──────────────────────────────────────────────

  const typeText = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
          i++;
          setInput(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(interval);
            resolve();
          }
        }, 40);
      }),
    [],
  );

  const scriptSend = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        const currentUsed = usedRef.current;
        const currentLimit = limitRef.current;
        const newUsed = currentUsed + 1;
        const newRemaining = currentLimit - newUsed;

        setMessages((prev) => [...prev, { role: "user" as const, text }]);
        setInput("");

        const cId = addCard("Sent a message");
        addEntry(cId, { type: "code", snippet: "check" });

        if (newRemaining < 0) {
          addEntry(cId, {
            type: "step",
            icon: "shield-alert",
            label: "allowed: false · limit reached",
            success: false,
          });
          setUsed(newUsed);
          resolve();
          return;
        }

        setTimeout(() => {
          addEntry(cId, {
            type: "step",
            icon: "shield",
            label: `allowed: true · ${newRemaining} remaining`,
          });
        }, 350);

        const scriptIdx = newUsed - 1;
        const reply =
          scriptIdx < scriptedReplies.length
            ? scriptedReplies[scriptIdx]!
            : interactiveReplies[scriptIdx % interactiveReplies.length]!;
        void streamReply(reply, () => {
          addEntry(cId, { type: "code", snippet: "report" });
          setTimeout(() => {
            addEntry(cId, {
              type: "step",
              icon: "refresh",
              label: `Usage recorded · ${newRemaining}/${currentLimit}`,
            });
            setUsed(newUsed);
          }, 200);
        }).then(() => {
          setTimeout(resolve, 300);
        });
      }),
    [addCard, addEntry, streamReply],
  );

  const wait = useCallback(
    (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    [],
  );

  const runAutoPlay = useCallback(async () => {
    await wait(1000);

    await typeText("How does billing work?");
    await wait(300);
    await scriptSend("How does billing work?");
    await wait(1500);

    await typeText("Can I add usage limits?");
    await wait(300);
    await scriptSend("Can I add usage limits?");
    await wait(1500);

    await typeText("What happens when I hit the limit?");
    await wait(300);
    await scriptSend("What happens when I hit the limit?");
  }, [typeText, scriptSend, wait]);

  // ── Intersection observer for auto-play ───────────────────────────

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasAutoPlayed.current) {
          hasAutoPlayed.current = true;
          void runAutoPlay();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [runAutoPlay]);

  return (
    <SectionContainer className="py-16 lg:py-24">
      <div className="mb-10 max-w-lg space-y-2 lg:mb-14">
        <h2 className="text-foreground/90 text-xl font-semibold tracking-tight sm:text-2xl">
          See it in action
        </h2>
        <p className="text-foreground/45 text-sm leading-relaxed sm:text-base">
          Click around the app below. Every interaction shows the PayKit code that runs and the
          steps it orchestrates, in real time.
        </p>
      </div>

      {/* Side by side — 65/35 */}
      <div ref={sectionRef} className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
        {/* Browser window — the app (65%) */}
        <WindowChrome
          label={
            <div className="bg-foreground/[0.04] text-foreground/30 flex-1 rounded-md px-3 py-1 text-center font-mono text-[10px]">
              localhost:3000
            </div>
          }
          className={cn("lg:w-[73%]", WINDOW_HEIGHT)}
        >
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Shared top bar */}
            <div className="border-foreground/[0.06] flex shrink-0 items-center justify-between border-b px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
                    plan === "pro"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-foreground/[0.06] text-foreground/40",
                  )}
                >
                  {plan === "pro" ? "Pro" : "Free"}
                </span>
                {plan === "pro" && (
                  <span className="text-foreground/25 text-[10px]">
                    {downgradeScheduled ? "Ends" : "Renews"} Apr 28, 2026
                  </span>
                )}
              </div>
              <span className="text-foreground/60 text-xs font-medium">AI Chat</span>
            </div>

            {/* Content — sidebar + chat */}
            <div className="flex min-h-0 flex-1">
              {/* Sidebar — billing */}
              <div className="border-foreground/[0.06] flex w-[200px] shrink-0 flex-col border-r">
                {/* Plan cards — stacked */}
                <div className="flex flex-col gap-2 px-3 py-3">
                  <div
                    className={cn(
                      "flex flex-col rounded-md border p-3 transition-all",
                      plan === "free"
                        ? "border-foreground/[0.12] bg-foreground/[0.02]"
                        : "border-foreground/[0.06]",
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground/80 text-xs font-semibold">Free</span>
                      <span className="text-foreground/40 text-[10px]">$0</span>
                    </div>
                    <span className="text-foreground/30 mt-0.5 text-[10px]">
                      {FREE_LIMIT} msg/mo
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={plan === "free" || downgradeScheduled || !!busy}
                      onClick={() => void handleDowngrade()}
                      className="mt-2 w-full text-[10px]"
                    >
                      {busy === "downgrade" ? (
                        <>
                          <Loader2 className="size-2.5 animate-spin" />
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
                  </div>

                  <div
                    className={cn(
                      "flex flex-col rounded-md border p-3 transition-all",
                      plan === "pro"
                        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                        : "border-foreground/[0.06]",
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground/80 text-xs font-semibold">Pro</span>
                      <span className="text-foreground/40 text-[10px]">$19/mo</span>
                    </div>
                    <span className="text-foreground/30 mt-0.5 text-[10px]">
                      {PRO_LIMIT} msg/mo
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={(plan === "pro" && !downgradeScheduled) || !!busy}
                      onClick={() => {
                        if (downgradeScheduled) {
                          void handleResubscribe();
                        } else {
                          void handleUpgrade();
                        }
                      }}
                      className={cn(
                        "mt-2 w-full text-[10px]",
                        blocked &&
                          plan === "free" &&
                          "animate-[glow-pulse_2s_ease-in-out_infinite]",
                      )}
                    >
                      {busy === "upgrade" ? (
                        <>
                          <Loader2 className="size-2.5 animate-spin" />
                          Upgrading...
                        </>
                      ) : busy === "resubscribe" ? (
                        <>
                          <Loader2 className="size-2.5 animate-spin" />
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
                  </div>
                </div>

                {/* Manage billing — pushed to bottom */}
                <div className="mt-auto px-3 py-3">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void handlePortal()}
                    className="text-foreground/70 w-full text-[10px]"
                  >
                    Manage billing
                  </Button>
                </div>
              </div>

              {/* Main — chat */}
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Messages */}
                <div ref={chatRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                  <div className="mt-auto" />
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[80%] rounded-md px-3 py-2 text-xs leading-relaxed",
                        msg.role === "user"
                          ? "bg-foreground/[0.06] text-foreground/65 self-end"
                          : "bg-foreground/[0.03] text-foreground/50 self-start",
                      )}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {aiState !== "idle" && (
                    <div className="bg-foreground/[0.03] text-foreground/50 max-w-[80%] self-start rounded-md px-3 py-2 text-xs leading-relaxed">
                      {aiState === "thinking" ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="bg-foreground/30 size-1 animate-bounce rounded-full [animation-delay:0ms]" />
                          <span className="bg-foreground/30 size-1 animate-bounce rounded-full [animation-delay:150ms]" />
                          <span className="bg-foreground/30 size-1 animate-bounce rounded-full [animation-delay:300ms]" />
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
                        className="mt-2 self-center rounded-md border border-red-500/15 bg-red-500/[0.04] px-4 py-2 text-center text-xs text-red-400"
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
                        className="mt-2 self-center rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-2 text-center text-xs text-emerald-500"
                      >
                        Upgraded to Pro! You can keep chatting.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input */}
                <div className="border-foreground/[0.06] flex shrink-0 items-center gap-2.5 border-t px-4 py-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                    }}
                    disabled={blocked || aiState !== "idle"}
                    placeholder={blocked ? "Upgrade to continue..." : "Type a message..."}
                    className="text-foreground placeholder:text-foreground/25 min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-40"
                  />
                  {/* Ring chart + counter */}
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
                        className={cn("transition-all duration-300", "stroke-foreground/25")}
                        style={{
                          strokeDasharray: `${2 * Math.PI * 8}`,
                          strokeDashoffset: `${2 * Math.PI * 8 * (1 - Math.min(1, limit > 0 ? used / limit : 0))}`,
                        }}
                      />
                    </svg>
                    <span className={cn("font-mono text-[10px]", "text-foreground/25")}>
                      {Math.max(0, remaining)}/{limit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={blocked || aiState !== "idle" || !input.trim()}
                    className="text-foreground/35 hover:text-foreground/60 disabled:opacity-20"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </WindowChrome>

        {/* Flow log — dashed border panel (35%) */}
        <div
          className={cn(
            "border-foreground/[0.12] bg-card flex flex-col overflow-hidden rounded-lg border border-dashed lg:w-[37%]",
            WINDOW_HEIGHT,
          )}
        >
          <div className="border-foreground/[0.08] flex h-10 shrink-0 items-center border-b border-dashed px-4">
            <span className="text-foreground/30 font-mono text-[10px] tracking-wider uppercase">
              BACK-END
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <FlowLog cards={cards} snippets={snippets} />
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
