import type { ReactNode } from "react";

import { CommandMenuProvider } from "@/components/command-menu";
import { NavigationBar } from "@/components/layout/navigation-bar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <CommandMenuProvider>
      <div className="relative h-dvh overflow-x-hidden">
        <NavigationBar />
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">{children}</div>
      </div>
    </CommandMenuProvider>
  );
}
