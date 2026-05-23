import type { Metadata } from "next";

import { ChangelogFooter } from "@/components/changelog/changelog-footer";
import { ChangelogRelease } from "@/components/changelog/changelog-release";
import { ChangelogSidebar } from "@/components/changelog/changelog-sidebar";
import { SectionShell } from "@/components/layout/section";
import { getReleases } from "@/lib/github";
import type { GitHubRelease } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Changelog – PayKit",
  description: "Stay up to date with the latest changes to PayKit.",
};

export default async function ChangelogPage() {
  const releases = (await getReleases()) as GitHubRelease[];
  const latestRelease = releases[0];

  return (
    <div className="mt-11 flex min-h-[calc(100dvh-2.75rem)] flex-col lg:mt-12 lg:h-[calc(100dvh-3rem)] lg:min-h-0 lg:overflow-hidden">
      <SectionShell className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(20rem,38%)_minmax(0,1fr)]">
        <ChangelogSidebar latestRelease={latestRelease} releaseCount={releases.length} />

        <div className="min-w-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            <div className="px-5 py-10 sm:px-8 lg:px-12 lg:py-12 xl:px-16">
              <div className="mb-10 flex items-center gap-4">
                <h2 className="text-foreground/35 shrink-0 font-mono text-[0.65rem] tracking-[0.25em] uppercase">
                  Changelog
                </h2>
                <div className="bg-border/80 h-px flex-1" />
              </div>

              {releases.length === 0 ? (
                <p className="text-foreground/45 text-sm">No releases found yet.</p>
              ) : (
                <div>
                  {releases.map((release) => (
                    <ChangelogRelease key={release.id} release={release} />
                  ))}
                </div>
              )}
            </div>

            <ChangelogFooter className="mt-0" />
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
