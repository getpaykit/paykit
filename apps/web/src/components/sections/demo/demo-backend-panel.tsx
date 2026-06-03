"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, User } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { FlowCard, SnippetKey } from "./demo-types";
import { stepIcons } from "./demo-types";

export function DemoBackendPanel({
  cards,
  snippets,
  className,
}: {
  cards: FlowCard[];
  snippets: Record<SnippetKey, ReactNode>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-foreground/[0.12] bg-card flex flex-col overflow-hidden rounded-none border border-dashed",
        className,
      )}
    >
      <div className="border-foreground/[0.08] flex h-10 shrink-0 items-center border-b border-dashed px-4">
        <span className="text-foreground/45 font-mono text-xs uppercase tracking-wider">
          Backend
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <FlowLog cards={cards} snippets={snippets} />
      </div>
    </div>
  );
}

function FlowLog({
  cards,
  snippets,
}: {
  cards: FlowCard[];
  snippets: Record<SnippetKey, ReactNode>;
}) {
  return (
    <div
      className="relative flex h-full flex-col-reverse overflow-hidden p-2"
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
              className="border-foreground/[0.08] shrink-0 overflow-hidden rounded-md border"
            >
              <div className="text-foreground/45 border-foreground/[0.06] flex items-center gap-2 border-b py-1.5 pr-1.5 pl-3 text-xs">
                <User className="size-3 shrink-0" />
                {card.trigger}
              </div>

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
                          <Loader2 className="text-foreground/35 size-3 shrink-0 animate-spin" />
                          <span className="text-foreground/40 text-xs">{entry.label}</span>
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
                                  : "text-foreground/45",
                            )}
                          >
                            {stepIcons[entry.icon]}
                          </motion.span>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: 0.05 }}
                            className={cn(
                              "text-xs",
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
        <div className="text-foreground/35 flex flex-1 items-center justify-center text-center text-sm">
          Interact with the app to see
          <br />
          what happens behind the scenes
        </div>
      )}
    </div>
  );
}
