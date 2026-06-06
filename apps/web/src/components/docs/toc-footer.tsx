import Link from "next/link";

import { URLs } from "@/lib/consts";

const progressValue = 65;

export function TocFooter() {
  return (
    <div className="flex flex-col">
      <Link
        href={URLs.roadmap}
        target="_blank"
        rel="noreferrer"
        className="border-border/80 bg-card/70 hover:border-foreground/15 hover:bg-card hover:shadow-foreground/5 focus-visible:ring-ring group mt-4 flex items-center gap-3 rounded-md border px-3 py-2 transition-colors transition-shadow transition-transform duration-75 ease-out will-change-transform hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <svg
          aria-hidden="true"
          className="size-8 shrink-0 -rotate-90 transition-transform duration-75"
          viewBox="0 0 32 32"
        >
          <circle cx="16" cy="16" r="12.5" fill="none" className="stroke-border" strokeWidth="5" />
          <circle
            cx="16"
            cy="16"
            r="12.5"
            fill="none"
            stroke="color-mix(in oklab, var(--color-foreground) 65%, transparent)"
            strokeWidth="5"
            strokeDasharray={`${(progressValue / 100) * 2 * Math.PI * 12.5} ${2 * Math.PI * 12.5}`}
          />
        </svg>
        <div className="min-w-0">
          <p className="text-foreground/80 group-hover:text-foreground/90 text-xs leading-4 font-medium transition-colors duration-75">
            Roadmap to v1
          </p>
          <p className="text-muted-foreground text-[0.65rem] leading-4">
            {progressValue}% complete
          </p>
        </div>
      </Link>
    </div>
  );
}
