import { unstable_cache } from "next/cache";

export interface Sponsor {
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  amount: string;
  amountInDollars: number;
  invertImageInDarkMode?: boolean;
  paymentCadence: "monthly" | "one-time" | null;
  kind: "company" | "individual";
}

export const SPONSORS_REVALIDATE_SECONDS = 60 * 60 * 6;
export const MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS = 10;

const GITHUB_SPONSORS_API_URL = "https://api.github.com/graphql";
const GITHUB_SPONSORABLE_LOGIN = "maxktz";
const GITHUB_SPONSORS_QUERY = `
  query PayKitSponsors($login: String!, $after: String) {
    user(login: $login) {
      sponsorshipsAsMaintainer(first: 100, after: $after, includePrivate: false) {
        nodes {
          sponsorEntity {
            __typename
            ... on User {
              login
              name
              avatarUrl
              url
            }
            ... on Organization {
              login
              name
              avatarUrl
              url
            }
          }
          isOneTimePayment
          tier {
            monthlyPriceInDollars
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

const hardCodedSponsors: Sponsor[] = [
  {
    name: "Vercel",
    href: "https://vercel.com/home",
    image: "/companies/vercel-mark.svg",
    imageAlt: "Vercel logo",
    amount: "$10,000 credits",
    amountInDollars: 10_000,
    invertImageInDarkMode: true,
    paymentCadence: null,
    kind: "company",
  },
  {
    name: "Efferd",
    href: "https://efferd.com",
    image: "/companies/efferd.svg",
    imageAlt: "Efferd logo",
    amount: "$250 credits",
    amountInDollars: 250,
    invertImageInDarkMode: true,
    paymentCadence: null,
    kind: "company",
  },
  {
    name: "MrPancakes39",
    href: "https://x.com/mrpancakes39",
    image: "https://pbs.twimg.com/profile_images/1991510200386207744/2Bfvjltn_200x200.jpg",
    imageAlt: "MrPancakes39's X avatar",
    amount: "$100 one-time",
    amountInDollars: 100,
    paymentCadence: "one-time",
    kind: "individual",
  },
  {
    name: "smorimoto",
    href: "https://github.com/smorimoto",
    image: "https://github.com/smorimoto.png?size=160",
    imageAlt: "smorimoto's GitHub avatar",
    amount: "$100 one-time",
    amountInDollars: 100,
    paymentCadence: "one-time",
    kind: "individual",
  },
  {
    name: "Ted Brine",
    href: "https://github.com/tedbrine",
    image: "https://github.com/tedbrine.png?size=160",
    imageAlt: "Ted Brine's GitHub avatar",
    amount: "$20 one-time",
    amountInDollars: 20,
    paymentCadence: "one-time",
    kind: "individual",
  },
  {
    name: "Lasse",
    href: "https://github.com/lassejlv",
    image: "https://github.com/lassejlv.png?size=160",
    imageAlt: "Lasse's GitHub avatar",
    amount: "$10 one-time",
    amountInDollars: 10,
    paymentCadence: "one-time",
    kind: "individual",
  },
  {
    name: "Coobyk",
    href: "https://github.com/Coobyk",
    image: "https://github.com/Coobyk.png?size=160",
    imageAlt: "Coobyk's GitHub avatar",
    amount: "$5 one-time",
    amountInDollars: 5,
    paymentCadence: "one-time",
    kind: "individual",
  },
];

const githubSponsorOverrides: Record<
  string,
  Partial<Pick<Sponsor, "image" | "imageAlt">> & { priceInDollars?: number }
> = {
  belk124: {
    priceInDollars: 20,
    image: "https://pbs.twimg.com/profile_images/2075769195908726784/okRA2bt9_400x400.jpg",
    imageAlt: "boden elk's X avatar",
  },
  leoisadev1: {
    priceInDollars: 20,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInaccessibleTierError(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "FORBIDDEN" || !Array.isArray(value.path)) return false;

  // Fine-grained tokens expose sponsors and cadence but can redact the optional tier per node.
  return value.path[value.path.length - 1] === "tier";
}

function createGitHubSponsor(value: unknown): Sponsor | null {
  if (!isRecord(value) || !isRecord(value.sponsorEntity)) return null;

  const { __typename, avatarUrl, login, name, url } = value.sponsorEntity;
  if (
    (__typename !== "User" && __typename !== "Organization") ||
    typeof avatarUrl !== "string" ||
    typeof login !== "string" ||
    typeof url !== "string" ||
    !avatarUrl ||
    !login ||
    !url
  ) {
    return null;
  }

  const displayName = typeof name === "string" && name.trim() ? name.trim() : login;
  const overrides = githubSponsorOverrides[login.toLowerCase()];
  const tierPrice = isRecord(value.tier) ? value.tier.monthlyPriceInDollars : null;
  const priceInDollars =
    overrides?.priceInDollars ??
    (typeof tierPrice === "number" && Number.isSafeInteger(tierPrice) && tierPrice > 0
      ? tierPrice
      : null);
  const cadence =
    value.isOneTimePayment === true
      ? "one-time"
      : value.isOneTimePayment === false
        ? "monthly"
        : null;

  return {
    name: displayName,
    href: url,
    image: overrides?.image ?? avatarUrl,
    imageAlt: overrides?.imageAlt ?? `${displayName}'s GitHub avatar`,
    amount:
      priceInDollars === null
        ? "GitHub Sponsor"
        : `$${priceInDollars.toLocaleString("en-US")}${cadence ? ` ${cadence}` : ""}`,
    amountInDollars: priceInDollars ?? 0,
    paymentCadence: cadence,
    kind: __typename === "Organization" ? "company" : "individual",
  };
}

interface GitHubSponsorsPage {
  endCursor: string | null;
  hasNextPage: boolean;
  sponsors: Sponsor[];
}

function createGitHubSponsorsPage(value: unknown): GitHubSponsorsPage {
  if (!isRecord(value)) throw new Error("Invalid GitHub sponsors response");

  if (
    value.errors !== undefined &&
    (!Array.isArray(value.errors) || value.errors.some((error) => !isInaccessibleTierError(error)))
  ) {
    throw new Error("GitHub sponsors response contained GraphQL errors");
  }

  if (!isRecord(value.data) || !isRecord(value.data.user)) {
    throw new Error("Invalid GitHub sponsors response");
  }

  const connection = value.data.user.sponsorshipsAsMaintainer;
  if (!isRecord(connection) || !Array.isArray(connection.nodes) || !isRecord(connection.pageInfo)) {
    throw new Error("Invalid GitHub sponsors response");
  }

  const { endCursor, hasNextPage } = connection.pageInfo;
  if (
    typeof hasNextPage !== "boolean" ||
    (endCursor !== null && typeof endCursor !== "string") ||
    (hasNextPage && !endCursor)
  ) {
    throw new Error("Invalid GitHub sponsors pagination data");
  }

  return {
    endCursor,
    hasNextPage,
    sponsors: connection.nodes
      .map(createGitHubSponsor)
      .filter((sponsor): sponsor is Sponsor => sponsor !== null),
  };
}

/** Converts a GitHub Sponsors GraphQL response into display-ready sponsors. */
export function createGitHubSponsors(value: unknown): Sponsor[] {
  return createGitHubSponsorsPage(value).sponsors;
}

async function fetchGitHubSponsors(): Promise<Sponsor[]> {
  const token = process.env.GITHUB_SPONSORS_TOKEN;
  if (!token) return [];

  const sponsors: Sponsor[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (;;) {
    const response = await fetch(GITHUB_SPONSORS_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        query: GITHUB_SPONSORS_QUERY,
        variables: { after, login: GITHUB_SPONSORABLE_LOGIN },
      }),
    });

    if (!response.ok)
      throw new Error(`GitHub sponsors fetch failed with status ${response.status}`);

    const page = createGitHubSponsorsPage(await response.json());
    sponsors.push(...page.sponsors);
    if (!page.hasNextPage) return sponsors;
    if (page.endCursor === null || seenCursors.has(page.endCursor)) {
      throw new Error("GitHub sponsors pagination cursor did not advance");
    }
    seenCursors.add(page.endCursor);
    after = page.endCursor;
  }
}

const getCachedGitHubSponsors = unstable_cache(fetchGitHubSponsors, ["github-sponsors"], {
  revalidate: SPONSORS_REVALIDATE_SECONDS,
});

function getGitHubSponsors(): Promise<Sponsor[]> {
  return process.env.NODE_ENV === "development" ? fetchGitHubSponsors() : getCachedGitHubSponsors();
}

function orderSponsorsByAmount(sponsors: Sponsor[]): Sponsor[] {
  return sponsors.reduce<Sponsor[]>((ordered, sponsor) => {
    const insertionIndex = ordered.findIndex(
      (candidate) =>
        sponsor.amountInDollars > candidate.amountInDollars ||
        (sponsor.amountInDollars === candidate.amountInDollars &&
          sponsor.paymentCadence === "monthly" &&
          candidate.paymentCadence !== "monthly"),
    );

    return insertionIndex === -1
      ? [...ordered, sponsor]
      : [...ordered.slice(0, insertionIndex), sponsor, ...ordered.slice(insertionIndex)];
  }, []);
}

function deduplicateSponsors(sponsors: Sponsor[]): Sponsor[] {
  const sponsorsByHref = new Map<string, Sponsor>();
  for (const sponsor of sponsors) {
    const key = sponsor.href.replace(/\/$/, "").toLowerCase();
    if (!sponsorsByHref.has(key)) sponsorsByHref.set(key, sponsor);
  }
  return [...sponsorsByHref.values()];
}

/** Returns hard-coded sponsors plus the six-hour cached GitHub sponsor list. */
export async function getSponsors(): Promise<Sponsor[]> {
  let githubSponsors: Sponsor[] = [];
  try {
    githubSponsors = await getGitHubSponsors();
  } catch (error) {
    console.error("GitHub sponsors fetch failed", error);
  }

  const sponsors = deduplicateSponsors([...hardCodedSponsors, ...githubSponsors]).filter(
    (sponsor) => sponsor.amountInDollars >= MINIMUM_SPONSORSHIP_AMOUNT_IN_DOLLARS,
  );
  const companies = sponsors.filter((sponsor) => sponsor.kind === "company");
  const individuals = orderSponsorsByAmount(
    sponsors.filter((sponsor) => sponsor.kind === "individual"),
  );

  return [...companies, ...individuals];
}
