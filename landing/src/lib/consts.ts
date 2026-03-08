import type { Organization, SoftwareApplication, WebSite, WithContext } from "schema-dts";

export const OG_IMAGE_PATH = "/og.png";
export const SITE_NAME = "PayKit";
export const SITE_TITLE = "PayKit — Open-source payment orchestration for TypeScript";
export const SITE_DESCRIPTION =
  "Open-source TypeScript payment toolkit that unifies multiple payment providers behind a single, extensible API.";
export const URLs = {
  site: "https://paykit.sh",
  githubOrg: "https://github.com/getpaykit",
  githubRepo: "https://github.com/getpaykit/paykit",
  x: "https://x.com/getpaykit",
  linkedin: "https://www.linkedin.com/company/getpaykit",
  discord: "https://discord.gg/paykit",
  authorGitHub: "https://github.com/maxktz",
  authorX: "https://x.com/maxk4tz",
} as const;

export const websiteSchema: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: URLs.site,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
};

export const organizationSchema: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: URLs.site,
  logo: `${URLs.site}/favicon/android-chrome-512x512.png`,
  sameAs: [URLs.githubOrg, URLs.githubRepo, URLs.x, URLs.linkedin],
};

export const softwareApplicationSchema: WithContext<SoftwareApplication> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  url: URLs.site,
  description: SITE_DESCRIPTION,
  image: `${URLs.site}${OG_IMAGE_PATH}`,
};

export const homePageStructuredData = [
  websiteSchema,
  organizationSchema,
  softwareApplicationSchema,
];
