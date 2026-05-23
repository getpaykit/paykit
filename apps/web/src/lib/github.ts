import { env } from "@/env";
import type { GitHubRelease } from "@/lib/releases";

export async function getReleases(): Promise<GitHubRelease[]> {
  const res = await fetch("https://api.github.com/repos/getpaykit/paykit/releases", {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
    headers: {
      ...(env.GITHUB_TOKEN && { Authorization: `Bearer ${env.GITHUB_TOKEN}` }),
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) throw new Error("Failed to fetch releases");

  return res.json() as Promise<GitHubRelease[]>;
}
