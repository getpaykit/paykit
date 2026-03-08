import Link from "next/link";

import { URLs } from "@/lib/consts";

const progressValue = 15;

export function TocProgressFooter() {
  return (
    <Link
      href={URLs.roadmap}
      target="_blank"
      rel="noreferrer"
      className="border-border/80 bg-card/70 hover:border-foreground/15 hover:bg-card hover:shadow-foreground/5 focus-visible:ring-ring group mt-4 flex items-center gap-3 rounded-md border px-3 py-2 transition-colors transition-shadow transition-transform duration-75 ease-out will-change-transform hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <div
        aria-hidden="true"
        className="relative size-8 shrink-0 rounded-full transition-transform duration-75"
        style={{
          background: `conic-gradient(color-mix(in oklab, var(--color-foreground) 65%, transparent) 0 ${progressValue}%, var(--color-border) ${progressValue}% 100%)`,
        }}
      >
        <div className="bg-card absolute inset-[5.5px] rounded-full" />
      </div>
      <div className="min-w-0">
        <p className="text-foreground/80 group-hover:text-foreground/90 text-xs leading-4 font-medium transition-colors duration-75">
          Roadmap to v1
        </p>
        <p className="text-muted-foreground text-[0.65rem] leading-4">{progressValue}% complete</p>
      </div>
    </Link>
  );
}
