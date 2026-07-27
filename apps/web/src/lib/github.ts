const GITHUB_REPOSITORY_API_URL = "https://api.github.com/repos/getpaykit/paykit";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

interface GitHubRepositoryResponse {
  stargazers_count?: unknown;
}

/** Returns the repository star count, cached by Next.js for one day. */
export async function getGitHubStarCount(): Promise<number | null> {
  try {
    const response = await fetch(GITHUB_REPOSITORY_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: ONE_DAY_IN_SECONDS },
    });

    if (!response.ok) return null;

    const repository = (await response.json()) as GitHubRepositoryResponse;
    return typeof repository.stargazers_count === "number" &&
      Number.isSafeInteger(repository.stargazers_count) &&
      repository.stargazers_count >= 0
      ? repository.stargazers_count
      : null;
  } catch {
    return null;
  }
}

/** Formats a count like GitHub, for example 1,050 as `1.1k`. */
export function formatGitHubStarCount(count: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(count)
    .toLowerCase();
}
