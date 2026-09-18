import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));

import {
  createGitHubSponsors,
  getSponsors,
  MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS,
} from "../sponsors-content";

function createGitHubSponsorNode(login: string, price: number, isOneTimePayment: boolean) {
  return {
    sponsorEntity: {
      avatarUrl: `https://avatars.githubusercontent.com/${login}`,
      login,
      name: login,
      url: `https://github.com/${login}`,
    },
    isOneTimePayment,
    tier: { monthlyPriceInDollars: price },
  };
}

function createGitHubResponse(nodes: unknown[]) {
  return {
    data: {
      user: {
        sponsorshipsAsMaintainer: { nodes },
      },
    },
  };
}

describe("createGitHubSponsors", () => {
  it("formats payment cadence reported by GitHub", () => {
    const monthlyAmount = MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS;
    const oneTimeAmount = monthlyAmount + 5;
    const sponsors = createGitHubSponsors(
      createGitHubResponse([
        createGitHubSponsorNode("monthly-sponsor", monthlyAmount, false),
        createGitHubSponsorNode("one-time-sponsor", oneTimeAmount, true),
      ]),
    );

    expect(sponsors?.map((sponsor) => sponsor.amount)).toEqual([
      `$${monthlyAmount} monthly`,
      `$${oneTimeAmount} one-time`,
    ]);
  });

  it("rejects an invalid GraphQL response", () => {
    expect(createGitHubSponsors({ data: { user: null } })).toBeNull();
  });
});

describe("getSponsors", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("filters below-minimum sponsors and orders monthly first when amounts match", async () => {
    vi.stubEnv("GITHUB_SPONSORS_TOKEN", "test-token");
    const monthlyLogin = "monthly-at-minimum";
    const oneTimeLogin = "one-time-at-minimum";
    const excludedLogin = "below-minimum";
    const fetch = vi.fn().mockResolvedValue({
      json: vi
        .fn()
        .mockResolvedValue(
          createGitHubResponse([
            createGitHubSponsorNode(oneTimeLogin, MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS, true),
            createGitHubSponsorNode(monthlyLogin, MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS, false),
            createGitHubSponsorNode(
              excludedLogin,
              MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS - 1,
              false,
            ),
          ]),
        ),
      ok: true,
    });
    vi.stubGlobal("fetch", fetch);

    const sponsors = await getSponsors();
    const monthlyIndex = sponsors.findIndex((sponsor) => sponsor.href.endsWith(`/${monthlyLogin}`));
    const oneTimeIndex = sponsors.findIndex((sponsor) => sponsor.href.endsWith(`/${oneTimeLogin}`));

    expect(monthlyIndex).toBeGreaterThanOrEqual(0);
    expect(oneTimeIndex).toBeGreaterThan(monthlyIndex);
    expect(sponsors.some((sponsor) => sponsor.href.endsWith(`/${excludedLogin}`))).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/graphql",
      expect.objectContaining({
        body: expect.stringContaining("isOneTimePayment"),
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("does not fetch without a GitHub token", async () => {
    vi.stubEnv("GITHUB_SPONSORS_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await getSponsors();

    expect(fetch).not.toHaveBeenCalled();
  });
});
