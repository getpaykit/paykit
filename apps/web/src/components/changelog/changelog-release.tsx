import Link from "next/link";

import { ReleaseBody } from "@/lib/html-parser";
import type { GitHubRelease } from "@/lib/releases";
import { formatReleaseDate } from "@/lib/releases";

type ChangelogReleaseProps = {
  release: GitHubRelease;
};

export function ChangelogRelease({ release }: ChangelogReleaseProps) {
  return (
    <article
      id={release.tag_name.replace(/[^a-zA-Z0-9-_]/g, "-")}
      className="border-border/60 scroll-mt-28 border-b border-dashed py-10 last:border-b-0 lg:py-12"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <Link href={release.html_url}>
              <h2 className="text-foreground/90 font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                {release.tag_name}
              </h2>
            </Link>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <time
                dateTime={release.published_at}
                className="text-foreground/40 font-mono text-xs tracking-wide"
              >
                {formatReleaseDate(release.published_at)}
              </time>
            </div>
          </div>
          {release.name && release.name !== release.tag_name ? (
            <p className="text-foreground/55 text-sm leading-snug">{release.name}</p>
          ) : null}
        </div>
      </header>

      {release.body ? (
        <div className="mt-6">
          <ReleaseBody body={release.body} />
        </div>
      ) : null}
    </article>
  );
}
