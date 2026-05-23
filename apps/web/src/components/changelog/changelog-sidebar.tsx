import { ExternalLink, Github, HistoryIcon } from "lucide-react";
import Link from "next/link";

import { URLs } from "@/lib/consts";
import type { GitHubRelease } from "@/lib/releases";
import { cn } from "@/lib/utils";

type ChangelogSidebarProps = {
  latestRelease: GitHubRelease | undefined;
  releaseCount: number;
};

export function ChangelogSidebar({ latestRelease, releaseCount }: ChangelogSidebarProps) {
  return (
    <aside
      className={cn(
        "border-border/60 relative min-w-0 shrink-0 overflow-hidden border-b lg:border-r lg:border-b-0",
        "lg:flex lg:h-full lg:flex-col lg:justify-center",
      )}
    >
      <div className="relative space-y-2 px-5 py-10 sm:px-8 lg:px-10 lg:py-12 xl:px-12">
        <p className="text-foreground/45 flex items-center gap-2 font-mono text-xs tracking-wide">
          <HistoryIcon className="size-3.5 shrink-0" aria-hidden />
          Changelog
        </p>
        <h1 className="text-foreground/90 text-2xl font-semibold tracking-tight sm:text-3xl">
          All changes, fixes, and updates
        </h1>
        <p className="text-foreground/45 max-w-sm text-sm leading-relaxed sm:text-base">
          Every release shipped to PayKit, straight from GitHub.
        </p>
      </div>

      <div className="relative mt-8 space-y-6 px-5 pb-10 sm:px-8 lg:mt-0 lg:px-10 lg:pb-12 xl:px-12">
        {latestRelease ? (
          <div className="border-border/80 space-y-2 border-t pt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground/35 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                Latest
              </p>
              <p className="text-foreground/80 font-mono text-sm">{latestRelease.tag_name}</p>
            </div>
          </div>
        ) : null}

        <div className="border-border/80 space-y-3 border-t pt-6">
          <p className="text-foreground/35 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            Source
          </p>
          <Link
            href={`${URLs.githubRepo}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/50 hover:text-foreground/80 group flex items-center gap-2 text-sm transition-colors"
          >
            <Github className="size-3.5 shrink-0" aria-hidden />
            <span className="font-mono text-xs tracking-wide uppercase">GitHub releases</span>
            <ExternalLink className="text-foreground/25 group-hover:text-foreground/50 size-3 shrink-0 transition-colors" />
          </Link>
          {releaseCount > 0 ? (
            <p className="text-foreground/35 font-mono text-xs">
              {releaseCount} release{releaseCount === 1 ? "" : "s"} loaded
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
