import { afterEach, describe, expect, it, vi } from "vitest";

const { unstableCache } = vi.hoisted(() => ({
  unstableCache: vi.fn((callback: (...args: never[]) => unknown) => callback),
}));

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

import {
  createGitHubSponsors,
  getSponsors,
  MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS,
  SPONSORS_REVALIDATE_SECONDS,
} from "../sponsors-content";

function createGitHubSponsorNode(
  login: string,
  price: number,
  isOneTimePayment: boolean,
  type: "Organization" | "User" = "User",
) {
  return {
    sponsorEntity: {
      __typename: type,
      avatarUrl: `https://avatars.githubusercontent.com/${login}`,
      login,
      name: login,
      url: `https://github.com/${login}`,
    },
    isOneTimePayment,
    tier: { monthlyPriceInDollars: price },
  };
}

function createGitHubResponse(
  nodes: unknown[],
  pageInfo: { endCursor: string | null; hasNextPage: boolean } = {
    endCursor: null,
    hasNextPage: false,
  },
) {
  return {
    data: {
      user: {
        sponsorshipsAsMaintainer: { nodes, pageInfo },
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
        createGitHubSponsorNode("monthly-sponsor", monthlyAmount, false, "Organization"),
        createGitHubSponsorNode("one-time-sponsor", oneTimeAmount, true),
      ]),
    );

    expect(sponsors?.map((sponsor) => sponsor.amount)).toEqual([
      `$${monthlyAmount} monthly`,
      `$${oneTimeAmount} one-time`,
    ]);
    expect(sponsors[0]?.kind).toBe("company");
  });

  it("rejects an invalid GraphQL response", () => {
    expect(() => createGitHubSponsors({ data: { user: null } })).toThrow(
      "Invalid GitHub sponsors response",
    );
  });

  it("rejects GraphQL errors outside the optional tier field", () => {
    expect(() =>
      createGitHubSponsors({
        ...createGitHubResponse([]),
        errors: [{ path: ["user"], type: "FORBIDDEN" }],
      }),
    ).toThrow("GitHub sponsors response contained GraphQL errors");
  });

  it("uses valid sponsor data when GitHub redacts tier fields", () => {
    const response = {
      ...createGitHubResponse([
        createGitHubSponsorNode("valid-sponsor", MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS, false),
        { sponsorEntity: null },
      ]),
      errors: [
        {
          path: ["user", "sponsorshipsAsMaintainer", "nodes", 0, "tier"],
          type: "FORBIDDEN",
        },
      ],
    };

    expect(createGitHubSponsors(response).map((sponsor) => sponsor.name)).toEqual([
      "valid-sponsor",
    ]);
  });
});

describe("sponsor cache", () => {
  it("uses the GitHub sponsor cache key and six-hour revalidation", () => {
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ["github-sponsors"], {
      revalidate: SPONSORS_REVALIDATE_SECONDS,
    });
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
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        json: vi
          .fn()
          .mockResolvedValue(
            createGitHubResponse(
              [createGitHubSponsorNode(oneTimeLogin, MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS, true)],
              { endCursor: "next-page", hasNextPage: true },
            ),
          ),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: vi
          .fn()
          .mockResolvedValue(
            createGitHubResponse([
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
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/graphql",
      expect.objectContaining({
        body: expect.stringContaining("isOneTimePayment"),
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "https://api.github.com/graphql",
      expect.objectContaining({ body: expect.stringContaining('"after":"next-page"') }),
    );
  });

  it("does not fetch without a GitHub token", async () => {
    vi.stubEnv("GITHUB_SPONSORS_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await getSponsors();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back when GitHub fails", async () => {
    vi.stubEnv("GITHUB_SPONSORS_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getSponsors()).resolves.not.toHaveLength(0);
  });

  it("stops pagination when GitHub repeats a cursor", async () => {
    vi.stubEnv("GITHUB_SPONSORS_TOKEN", "test-token");
    const repeatedPage = {
      json: vi
        .fn()
        .mockResolvedValue(
          createGitHubResponse([], { endCursor: "same-cursor", hasNextPage: true }),
        ),
      ok: true,
    };
    const fetch = vi.fn().mockResolvedValue(repeatedPage);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await getSponsors();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      "GitHub sponsors fetch failed",
      expect.objectContaining({ message: "GitHub sponsors pagination cursor did not advance" }),
    );
  });
});
