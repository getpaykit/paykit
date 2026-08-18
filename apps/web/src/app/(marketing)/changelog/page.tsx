import type { Metadata } from "next";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { Section, SectionContent } from "@/components/layout/section";
import { FooterSection } from "@/components/sections/footer-section";
import {
  createChangelogReleases,
  GITHUB_RELEASES_API_URL,
  type GitHubRelease,
} from "@/lib/changelog";
import { URLs } from "@/lib/consts";

import { ChangelogContent } from "./changelog-content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Changelog",
  description: "Latest changes, fixes, and updates to PayKit.",
  alternates: {
    canonical: "/changelog",
  },
};

/** Fetches published releases from GitHub with an hourly cache. */
async function getReleases() {
  try {
    const response = await fetch(GITHUB_RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate },
    });

    if (!response.ok) {
      console.error(`GitHub release fetch failed with status ${response.status}`);
      return [];
    }

    const releases = (await response.json()) as GitHubRelease[];
    return createChangelogReleases(releases);
  } catch (error) {
    console.error("GitHub release fetch failed", error);
    return [];
  }
}

export default async function ChangelogPage() {
  const releases = await getReleases();
  const latest = releases[0]?.tag;

  return (
    <div className="relative pt-11 lg:pt-12">
      <Section>
        <SectionContent className="py-10 sm:py-12 lg:py-20">
          <div className="mx-auto w-full max-w-3xl">
            <div className="space-y-3.5 sm:space-y-5">
              <div className="text-foreground/60 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Latest</span>
                  <span className="text-foreground/80">{latest ?? "Unavailable"}</span>
                </div>
                <Link
                  href={URLs.githubReleases}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <Icons.GitHubIcon className="size-3.5 opacity-60" />
                  GitHub Releases
                </Link>
              </div>
              <h1 className="max-w-2xl text-3xl leading-tight tracking-tight text-neutral-800 sm:text-3xl md:text-3xl lg:text-[2.55rem] dark:text-neutral-200">
                Changelog, all changes and fixes
              </h1>
              <p className="text-foreground/70 dark:text-foreground/50 max-w-md text-sm leading-relaxed sm:text-base">
                Every release shipped to PayKit, straight from GitHub.
              </p>
            </div>
          </div>
        </SectionContent>
      </Section>

      <Section>
        <ChangelogContent releases={releases} />
        <div className="px-5 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Link
              href={URLs.githubReleases}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
            >
              View all releases on GitHub &rarr;
            </Link>
          </div>
        </div>
      </Section>

      <FooterSection />
    </div>
  );
}
