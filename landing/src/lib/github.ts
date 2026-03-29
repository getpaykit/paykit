export async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/getpaykit/paykit", {
      next: { revalidate: 14400 }, // 4 hours
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { stargazers_count?: number };
    return data.stargazers_count ?? null;
  } catch {
    return null;
  }
}
