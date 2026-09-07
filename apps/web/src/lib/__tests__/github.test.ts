import { afterEach, describe, expect, it, vi } from "vitest";

import { formatGitHubStarCount, getGitHubStarCount } from "../github";

describe("getGitHubStarCount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a valid repository star count", async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ stargazers_count: 1050 }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetch);

    await expect(getGitHubStarCount()).resolves.toBe(1050);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/getpaykit/paykit",
      expect.objectContaining({ next: { revalidate: 86_400 } }),
    );
  });

  it.each([
    ["a missing count", {}],
    ["a string count", { stargazers_count: "1050" }],
    ["a negative count", { stargazers_count: -1 }],
    ["a fractional count", { stargazers_count: 1.5 }],
    ["an unsafe count", { stargazers_count: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects %s", async (_description, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(body), ok: true }),
    );

    await expect(getGitHubStarCount()).resolves.toBeNull();
  });

  it("returns null for unsuccessful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(getGitHubStarCount()).resolves.toBeNull();
  });

  it("returns null when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(getGitHubStarCount()).resolves.toBeNull();
  });
});

describe("formatGitHubStarCount", () => {
  it.each([
    [999, "999"],
    [1050, "1.1k"],
    [10_000, "10k"],
    [1_250_000, "1.3m"],
  ])("formats %i as %s", (count, expected) => {
    expect(formatGitHubStarCount(count)).toBe(expected);
  });
});
