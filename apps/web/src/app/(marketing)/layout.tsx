import type { ReactNode } from "react";

import { NavigationBar } from "@/components/layout/navigation-bar";
import { PageTransition } from "@/components/layout/page-transition";
import { formatGitHubStarCount, getGitHubStarCount } from "@/lib/github";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const starCount = await getGitHubStarCount();

  return (
    <div className="bg-background text-foreground min-h-dvh overflow-x-clip">
      <NavigationBar stars={starCount === null ? undefined : formatGitHubStarCount(starCount)} />
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
