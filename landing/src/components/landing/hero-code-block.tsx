"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type View = "code" | "terminal";

const pushSteps = [
  { text: "$ npx paykitjs push", type: "command" as const },
  { text: "", type: "pause" as const },
  { text: "", type: "blank" as const },
  { text: "Syncing plans to Stripe...", type: "info" as const },
  { text: "✓ Plan 'free' synced", type: "success" as const },
  { text: "✓ Plan 'pro' synced", type: "success" as const },
  { text: "", type: "blank" as const },
  { text: "Syncing features...", type: "info" as const },
  { text: "✓ Feature 'messages' (metered)", type: "success" as const },
  { text: "✓ Feature 'pro_models' (boolean)", type: "success" as const },
  { text: "", type: "blank" as const },
  { text: "Applying database migrations...", type: "info" as const },
  { text: "✓ 5 tables created (paykit_*)", type: "success" as const },
  { text: "", type: "blank" as const },
  { text: "Done.", type: "done" as const },
];

export function HeroCodeBlock({
  plansCodeBlock,
  configCodeBlock,
}: {
  plansCodeBlock: ReactNode;
  configCodeBlock: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"plans" | "config">("plans");
  const [view, setView] = useState<View>("code");
  const [terminalLines, setTerminalLines] = useState<typeof pushSteps>([]);
  const [pushing, setPushing] = useState(false);

  const runPush = useCallback(async () => {
    if (pushing) return;
    setPushing(true);
    setView("terminal");
    setTerminalLines([]);

    for (const step of pushSteps) {
      const delay =
        step.type === "command"
          ? 200
          : step.type === "pause"
            ? 800
            : step.type === "blank"
              ? 100
              : step.type === "done"
                ? 300
                : 250;

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (step.type !== "pause") {
            setTerminalLines((prev) => [...prev, step]);
          }
          resolve();
        }, delay);
      });
    }

    setPushing(false);
  }, [pushing]);

  const backToCode = useCallback(() => {
    setView("code");
    setTerminalLines([]);
  }, []);

  return (
    <div className="border-foreground/[0.1] bg-card overflow-hidden flex flex-1 flex-col rounded-md border lg:max-w-[37.5rem]">
      {/* Tab bar */}
      <div className="border-foreground/[0.08] flex items-center border-b">
        <div className="flex flex-1">
          {view === "code" ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("plans")}
                className={cn(
                  "relative px-4 py-2 text-[13px] transition-colors",
                  activeTab === "plans"
                    ? "text-foreground/80"
                    : "text-foreground/40 hover:text-foreground/60",
                )}
              >
                plans.ts
                {activeTab === "plans" && (
                  <span className="bg-foreground/50 absolute right-2 bottom-0 left-2 h-px" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("config")}
                className={cn(
                  "relative px-4 py-2 text-[13px] transition-colors",
                  activeTab === "config"
                    ? "text-foreground/80"
                    : "text-foreground/40 hover:text-foreground/60",
                )}
              >
                paykit.ts
                {activeTab === "config" && (
                  <span className="bg-foreground/50 absolute right-2 bottom-0 left-2 h-px" />
                )}
              </button>
            </>
          ) : (
            <span className="text-foreground/50 px-4 py-2 font-mono text-[13px]">Terminal</span>
          )}
        </div>

        {/* Push / back button */}
        <div className="pr-2">
          {view === "code" ? (
            <button
              type="button"
              onClick={() => void runPush()}
              disabled={pushing}
              className="text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-all"
            >
              <Play className="size-3" />
              Push to Stripe
            </button>
          ) : (
            <button
              type="button"
              onClick={backToCode}
              disabled={pushing}
              className="text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05] flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-all disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              Back to code
            </button>
          )}
        </div>
      </div>

      {/* Content — fixed height */}
      <div className="h-[27.5rem] overflow-y-auto">
        {view === "code" ? (
          <>
            <div className={activeTab === "plans" ? "block" : "hidden"}>{plansCodeBlock}</div>
            <div className={activeTab === "config" ? "block" : "hidden"}>{configCodeBlock}</div>
          </>
        ) : (
          <div className="h-full bg-[#0a0a0a] p-4 font-mono text-[12px] leading-relaxed">
            <AnimatePresence initial={false}>
              {terminalLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "min-h-[1.4em]",
                    line.type === "command" && "text-white/80",
                    line.type === "info" && "text-white/40",
                    line.type === "success" && "text-emerald-400/80",
                    line.type === "done" && "font-medium text-emerald-400",
                    line.type === "blank" && "h-2",
                  )}
                >
                  {line.type !== "blank" && line.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {pushing && terminalLines.length > 0 && (
              <Loader2 className="mt-1 size-3 animate-spin text-white/30" />
            )}
            {!pushing && terminalLines.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 flex items-center gap-1.5 text-emerald-400/60"
              >
                <Check className="size-3" />
                <span className="text-[11px]">All changes pushed</span>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
