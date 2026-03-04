"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StaggeredNavFiles } from "@/components/landing/staggered-nav-files";

export function RouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/docs")) {
    return (
      <div className="h-dvh overflow-y-auto overflow-x-hidden scroll-smooth">
        {children}
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-x-hidden">
      <StaggeredNavFiles />
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
