import type { ReactNode } from "react";

import { CommandMenuProvider } from "@/components/command-menu";
import { EarlyDevProvider } from "@/components/landing/early-dev-dialog";
import { NavigationBar } from "@/components/layout/navigation-bar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <EarlyDevProvider>
      <CommandMenuProvider>
        <div className="relative h-dvh overflow-x-hidden">
          <NavigationBar />
          <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">{children}</div>
        </div>
      </CommandMenuProvider>
    </EarlyDevProvider>
  );
}
