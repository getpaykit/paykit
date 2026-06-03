import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const sectionShellWidth =
  "w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full";

// ─── Shared section line ─────────────────────────────────────────────

export function SectionLine({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const isH = orientation === "horizontal";
  return (
    <div
      className={cn(
        "pointer-events-none absolute bg-border",
        isH ? "left-0 h-px w-full" : "top-0 h-full w-px",
      )}
    />
  );
}

export function SectionShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto max-w-[72rem]", sectionShellWidth, className)}>
      <SectionLine orientation="vertical" />
      <div className="absolute top-0 right-0 h-full">
        <SectionLine orientation="vertical" />
      </div>
      {children}
    </div>
  );
}

// ─── Section (outer wrapper with solid borders) ──────────────────────

export function Section({
  children,
  className,
  last,
}: {
  children: ReactNode;
  className?: string;
  last?: boolean;
}) {
  return (
    <SectionShell className={className}>
      {!last && (
        <div className="absolute bottom-0 left-0 h-px w-full">
          <SectionLine orientation="horizontal" />
        </div>
      )}
      {children}
    </SectionShell>
  );
}

// ─── SectionContent (padded content area) ────────────────────────────

export function SectionContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-8 sm:px-8 sm:py-10 lg:p-12", className)}>{children}</div>;
}

// ─── SectionSeparator ────────────────────────────────────────────────

export function SectionSeparator() {
  return (
    <div className="relative h-px w-full">
      <SectionLine orientation="horizontal" />
    </div>
  );
}
