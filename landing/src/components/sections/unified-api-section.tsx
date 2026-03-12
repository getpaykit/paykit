"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function UnifiedApiSection({
  tabs,
}: {
  tabs: Array<{
    content: ReactNode;
    name: string;
  }>;
}) {
  const tabNames = tabs.map((tab) => tab.name);
  const [activeTab, setActiveTab] = useState<string>(tabNames[0] ?? "Checkout");

  return (
    <div className="my-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-foreground/85 dark:text-foreground/75 text-base">
          Unified <span className="text-emerald-500 dark:text-emerald-400">API</span>
        </span>
        <div className="bg-foreground/[0.08] h-px flex-1" />
      </div>

      <p className="text-foreground/55 dark:text-foreground/45 mb-5 max-w-xl text-sm leading-relaxed">
        One API for checkout, subscriptions, invoices, and events — regardless of which payment
        provider you use.
      </p>

      <div className="border-foreground/[0.1] dark:bg-background/40 overflow-hidden rounded-sm border bg-neutral-50/50">
        <div className="border-foreground/[0.09] dark:bg-card/50 no-scrollbar flex overflow-x-auto border-b bg-neutral-100/50">
          {tabNames.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-foreground/[0.08] relative flex shrink-0 items-center gap-1.5 border-r px-3 py-2 font-mono text-[13px] transition-colors last:border-r-0 ${
                activeTab === tab
                  ? "text-foreground/90 bg-foreground/[0.03]"
                  : "text-foreground/45 hover:text-foreground/70"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute right-0 bottom-0 left-0 h-px bg-emerald-500/70 dark:bg-emerald-400/60" />
              )}
            </button>
          ))}
        </div>

        <div>
          {tabs.map((tab) => (
            <div key={tab.name} className={activeTab === tab.name ? "block" : "hidden"}>
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
