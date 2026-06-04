import type { ReactNode } from "react";

import { NavigationBar } from "@/components/layout/navigation-bar";
import { PageTransition } from "@/components/layout/page-transition";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark bg-background text-foreground min-h-dvh overflow-x-hidden">
      <NavigationBar stars={null} />
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
