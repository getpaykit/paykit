export const GITHUB_RELEASES_API_URL =
  "https://api.github.com/repos/getpaykit/paykit/releases?per_page=100";

export interface GitHubRelease {
  body: string | null;
  created_at: string;
  draft: boolean;
  html_url: string;
  id: number;
  name: string | null;
  prerelease: boolean;
  published_at: string | null;
  tag_name: string;
}

export interface ChangelogRelease {
  content: string;
  contributors: string[];
  date: string;
  expandable: boolean;
  id: number;
  tag: string;
  title: string;
  url: string;
}

const EXPANDABLE_LINE_THRESHOLD = 15;
const GITHUB_USERNAME_REGEX =
  /(?:^|[^\w.+-])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?![A-Za-z0-9-]|\/)/g;
const EMOJI_REGEX = /\p{Extended_Pictographic}\uFE0F?/gu;

const CHANGESET_HEADINGS: Record<string, string> = {
  "major changes": "Breaking Changes",
  "minor changes": "Features",
  "patch changes": "Bug Fixes",
};

function getContributors(content: string) {
  const contributors = new Map<string, string>();
  let inContributorsSection = false;

  for (const line of content.split("\n")) {
    if (/^##\s+contributors\s*$/i.test(line.trim())) {
      inContributorsSection = true;
      continue;
    }

    if (/^##\s+/.test(line)) inContributorsSection = false;

    const creditedText = inContributorsSection
      ? line
      : line.match(/(?:\bby\s+|\bAuthor:\s*|\bThanks\s+)(.+)/i)?.[1];
    if (!creditedText) continue;

    for (const match of creditedText.matchAll(GITHUB_USERNAME_REGEX)) {
      const username = match[1];
      if (username) contributors.set(username.toLowerCase(), username);
    }
  }

  return [...contributors.values()];
}

function normalizeChangesetLine(line: string) {
  const match = line.match(
    /^(\s*-\s+)(?:(\[#\d+\]\([^)]+\))\s+)?(?:((?:\[`[^`]+`\]\([^)]+\)))\s+)?Thanks\s+.+?!\s+-\s+(.+)$/,
  );

  if (!match) return line;

  const [, prefix, pullRequest, commit, summary] = match;
  const reference = pullRequest ?? commit;
  return `${prefix}${summary}${reference ? ` (${reference})` : ""}`;
}

/** Converts generated and legacy GitHub copy into PayKit release-note prose. */
export function normalizeReleaseNotes(body: string) {
  const source = body
    .replaceAll("\r", "")
    .replaceAll(/<\/?samp>/g, "")
    .replaceAll(/&nbsp;?/g, " ")
    .replaceAll(EMOJI_REGEX, "");
  const contributors = getContributors(source);
  const content: string[] = [];
  let inContributorsSection = false;

  for (const rawLine of source.split("\n")) {
    let line = rawLine.trimEnd();
    if (/^#####\s+\[View changes on GitHub\]\(/i.test(line.trim())) {
      line = line.trim().replace(/^#####\s+/, "");
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      const [, level, rawTitle] = heading;
      const title = rawTitle?.replaceAll(/\s+/g, " ").trim() ?? "";

      if (level === "##" && title.toLowerCase() === "contributors") {
        inContributorsSection = true;
        continue;
      }

      if (inContributorsSection && level === "##") inContributorsSection = false;

      const normalizedTitle = CHANGESET_HEADINGS[title.toLowerCase()] ?? title;
      line = `${level} ${normalizedTitle}`;
    }

    if (inContributorsSection) {
      if (line.startsWith("**Full changelog:**")) {
        inContributorsSection = false;
      } else {
        continue;
      }
    }

    line = normalizeChangesetLine(line)
      .replace(
        /\s+-\s+by\s+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?(?:\s+\[\([^)]+\)\]\([^)]+\))?\s*$/,
        "",
      )
      .replace(/\s+\(Author:\s+.+\)\s*$/, "");

    content.push(line);
  }

  return {
    content: content
      .join("\n")
      .replaceAll(/\n{3,}/g, "\n\n")
      .trim(),
    contributors,
  };
}

/** Formats a Changesets entry for its public GitHub release. */
export function formatGitHubReleaseNotes(source: string) {
  const { content, contributors } = normalizeReleaseNotes(source);

  if (contributors.length === 0) return content;

  const contributorSection = [
    "## Contributors",
    "Thanks to everyone who contributed to this release:",
    contributors.map((username) => `@${username}`).join(", "),
  ].join("\n\n");

  return [content, contributorSection].filter(Boolean).join("\n\n");
}

/** Converts published stable GitHub releases into changelog entries. */
export function createChangelogReleases(releases: GitHubRelease[]): ChangelogRelease[] {
  return releases
    .filter((release) => !release.draft && !release.prerelease && release.published_at)
    .map((release) => {
      const { content, contributors } = normalizeReleaseNotes(release.body ?? "");
      const lineCount = content.split("\n").filter((line) => line.trim()).length;

      return {
        content,
        contributors,
        date: new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(release.published_at!)),
        expandable: lineCount > EXPANDABLE_LINE_THRESHOLD,
        id: release.id,
        tag: release.tag_name,
        title: release.name || release.tag_name,
        url: release.html_url,
      };
    });
}
