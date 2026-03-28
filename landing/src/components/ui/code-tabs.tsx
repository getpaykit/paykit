"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function CodeTabs({
  tabs,
  defaultTab,
}: {
  tabs: { name: string; content: ReactNode }[];
  defaultTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.name ?? "");

  return (
    <div className="dark:bg-background border-foreground/[0.1] relative overflow-hidden border bg-neutral-50">
      <div className="border-foreground/[0.08] dark:bg-card/50 flex border-b bg-neutral-100/50">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            onClick={() => setActiveTab(tab.name)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-[13px] transition-colors ${
              activeTab === tab.name
                ? "text-foreground/80"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {tab.name}
            {activeTab === tab.name && (
              <span className="bg-foreground/50 absolute right-2 bottom-0 left-2 h-px" />
            )}
          </button>
        ))}
      </div>

      <div className="relative">
        {tabs.map((tab) => (
          <div key={tab.name} className={activeTab === tab.name ? "block" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
