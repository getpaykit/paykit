"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Section, SectionContent } from "@/components/layout/section";

import { DemoAppWindow } from "./demo-app-window";
import { DemoBackendPanel } from "./demo-backend-panel";
import type { FlowCard, FlowEntry, SnippetKey } from "./demo-types";
import { FREE_LIMIT, INITIAL_USED, PRO_LIMIT, interactiveReplies, nextCardId } from "./demo-types";
import { useDemoAutoPlay } from "./use-demo-autoplay";

const WINDOW_HEIGHT = "h-80 md:h-144";

export function DemoSection({ snippets }: { snippets: Record<SnippetKey, ReactNode> }) {
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [downgradeScheduled, setDowngradeScheduled] = useState(false);
  const [busy, setBusy] = useState<"" | "upgrade" | "downgrade" | "resubscribe">("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [used, setUsed] = useState(INITIAL_USED);
  const [input, setInput] = useState("");
  const [aiState, setAiState] = useState<"idle" | "thinking" | "streaming">("idle");
  const [streamingText, setStreamingText] = useState("");
  const [cards, setCards] = useState<FlowCard[]>([]);
  const [upgradeBanner, setUpgradeBanner] = useState(false);
  const [autoTyping, setAutoTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
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

  // ─── Card helpers ──────────────────────────────────────────────────

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
        const pendingLabel = entry.type === "step" ? entry.label : "";
        addEntry(cId, { type: "pending", label: pendingLabel });

        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => {
              if (c.id !== cId) return c;
              const entries = [...c.entries];
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

  // ─── Action handlers ───────────────────────────────────────────────

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

  const handleResubscribe = useCallback(async () => {
    if (!downgradeScheduled || busy) return;
    setBusy("resubscribe");

    const cId = addCard("Clicked Resubscribe");
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

    setTimeout(() => {
      addEntry(cId, {
        type: "step",
        icon: "shield",
        label: `allowed: true · ${newRemaining} remaining`,
      });
    }, 350);

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

  // ─── Auto-play ─────────────────────────────────────────────────────

  useDemoAutoPlay({
    sectionRef,
    setInput,
    setAutoTyping,
    setMessages,
    setUsed,
    addCard,
    addEntry,
    streamReply,
    usedRef,
    limitRef,
  });

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <Section>
      <SectionContent className="relative border-b px-5 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-6">
        <div className="max-w-lg space-y-2">
          <h2 className="text-foreground/90 text-xl font-medium tracking-tight sm:text-2xl">
            How it works
          </h2>
        </div>
      </SectionContent>

      <SectionContent className="px-5 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-8">
        <div
          ref={sectionRef}
          className="flex flex-col-reverse gap-2 md:flex-row md:items-stretch md:gap-4"
        >
          <DemoAppWindow
            plan={plan}
            downgradeScheduled={downgradeScheduled}
            busy={busy}
            messages={messages}
            used={used}
            input={input}
            limit={limit}
            blocked={blocked}
            aiState={aiState}
            streamingText={streamingText}
            upgradeBanner={upgradeBanner}
            autoTyping={autoTyping}
            chatRef={chatRef}
            className={`${WINDOW_HEIGHT} md:w-1/2 lg:flex-[2]`}
            onInputChange={setInput}
            onSend={handleSend}
            onUpgrade={() => void handleUpgrade()}
            onDowngrade={() => void handleDowngrade()}
            onResubscribe={() => void handleResubscribe()}
            onPortal={() => void handlePortal()}
          />

          <DemoBackendPanel
            cards={cards}
            snippets={snippets}
            className="h-58 md:h-144 md:w-1/2 lg:flex-[1]"
          />
        </div>
      </SectionContent>
    </Section>
  );
}
