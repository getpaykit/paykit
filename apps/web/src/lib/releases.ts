export type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  mentions_count: number;
};

export function extractContributors(body: string): string[] {
  return [...new Set([...body.matchAll(/@([a-zA-Z0-9-]+)/g)].map((match) => match[1]!))];
}

export function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
