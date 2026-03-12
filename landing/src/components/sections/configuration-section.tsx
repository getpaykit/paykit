"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function ConfigurationSection({
  handlerCodeBlock,
  serverCodeBlock,
}: {
  handlerCodeBlock: ReactNode;
  serverCodeBlock: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"handler" | "server">("server");

  return (
    <div className="my-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-foreground/60 dark:text-foreground/40 shrink-0 font-mono text-xs tracking-wider uppercase">
          Configuration
        </span>
        <div className="border-foreground/[0.06] flex-1 border-t" />
      </div>

      <div className="relative">
        <div className="dark:bg-background border-foreground/[0.1] relative overflow-hidden rounded-sm border bg-neutral-50">
          <div className="border-foreground/[0.08] dark:bg-card/50 flex border-b bg-neutral-100/50">
            <button
              type="button"
              onClick={() => setActiveTab("server")}
              className={`relative flex items-center gap-1.5 px-4 py-2 font-mono text-[13px] transition-colors ${
                activeTab === "server"
                  ? "text-foreground/80"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              paykit.ts
              {activeTab === "server" && (
                <span className="bg-foreground/50 absolute right-2 bottom-0 left-2 h-px" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("handler")}
              className={`relative flex items-center gap-1.5 px-4 py-2 font-mono text-[13px] transition-colors ${
                activeTab === "handler"
                  ? "text-foreground/80"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              route.ts
              {activeTab === "handler" && (
                <span className="bg-foreground/50 absolute right-2 bottom-0 left-2 h-px" />
              )}
            </button>
          </div>

          <div className="relative">
            <div className={activeTab === "server" ? "block" : "hidden"}>{serverCodeBlock}</div>
            <div className={activeTab === "handler" ? "block" : "hidden"}>{handlerCodeBlock}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
