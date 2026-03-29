import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// ─── Shared dashed line ──────────────────────────────────────────────

export function DashedLine({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const isH = orientation === "horizontal";
  return (
    <svg
      className={cn(
        "pointer-events-none absolute stroke-foreground/20",
        isH ? "left-0 h-px w-full" : "top-0 h-full w-px",
      )}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="0"
        x2={isH ? "100%" : "0"}
        y2={isH ? "0" : "100%"}
        stroke="inherit"
        strokeWidth="1"
        strokeDasharray="6 8"
      />
    </svg>
  );
}

// ─── Corner marks ────────────────────────────────────────────────────

function CornerMark({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute size-2 stroke-foreground/20",
        position === "tl" && "-top-1 -left-1",
        position === "tr" && "-top-1 -right-1",
        position === "bl" && "-bottom-1 -left-1",
        position === "br" && "-bottom-1 -right-1",
      )}
      viewBox="0 0 8 8"
    >
      <line x1="0" y1="4" x2="8" y2="4" stroke="inherit" strokeWidth="1" />
      <line x1="4" y1="0" x2="4" y2="8" stroke="inherit" strokeWidth="1" />
    </svg>
  );
}

// ─── Section (outer wrapper with borders + corners + label) ──────────

export function Section({
  children,
  className,
  label,
  last,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  last?: boolean;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[76rem]", className)}>
      {/* Left border */}
      <DashedLine orientation="vertical" />
      {/* Right border */}
      <div className="absolute top-0 right-0 h-full">
        <DashedLine orientation="vertical" />
      </div>
      {/* Bottom border — section width */}
      {!last && (
        <div className="absolute bottom-0 left-0 w-full">
          <DashedLine orientation="horizontal" />
        </div>
      )}

      {/* Corner marks */}
      {/*<CornerMark position="tl" />
      <CornerMark position="tr" />
      <CornerMark position="bl" />
      <CornerMark position="br" />*/}

      {/* Section label */}
      {/*{label && (
        <span className="text-foreground/15 absolute top-2 left-2 font-mono text-[9px] uppercase tracking-widest">
          {label}
        </span>
      )}*/}

      {children}
    </div>
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
  return <div className={cn("p-12", className)}>{children}</div>;
}

// ─── SectionSeparator (full section-width dashed line) ───────────────

export function SectionSeparator() {
  return (
    <div className="relative h-px w-full">
      <DashedLine orientation="horizontal" />
    </div>
  );
}
