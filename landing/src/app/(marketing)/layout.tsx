import type { ReactNode } from "react";

import { CommandMenuProvider } from "@/components/command-menu";
import { NavigationBar } from "@/components/layout/navigation-bar";
import { getGitHubStars } from "@/lib/github";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const stars = await getGitHubStars();

  return (
    <CommandMenuProvider>
      <div className="relative h-dvh overflow-x-hidden">
        <NavigationBar stars={stars} />
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">{children}</div>
      </div>
    </CommandMenuProvider>
  );
}
