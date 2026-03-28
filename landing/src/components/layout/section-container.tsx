import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-20", className)}>
      {children}
    </div>
  );
}
