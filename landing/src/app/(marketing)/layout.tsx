import type { ReactNode } from "react";

import { CommandMenuProvider } from "@/components/command-menu";
import { NavigationBar } from "@/components/layout/navigation-bar";
import { PageTransition } from "@/components/layout/page-transition";
import { getGitHubStars } from "@/lib/github";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  // const stars = await getGitHubStars();

  return (
    <CommandMenuProvider>
      <div className="dark bg-background text-foreground relative h-dvh overflow-x-hidden">
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">
          <NavigationBar stars={null} />
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </CommandMenuProvider>
  );
}
