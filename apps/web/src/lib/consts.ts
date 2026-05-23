import type { FAQPage, Organization, SoftwareApplication, WebSite, WithContext } from "schema-dts";

export const OG_IMAGE_PATH = "/brand/og.png";
export const SITE_NAME = "PayKit";

export const SITE_TITLE = "PayKit – The billing framework for TypeScript";
export const SITE_DESCRIPTION =
  "Open-source billing framework for TypeScript. Define plans in code. Handles Stripe, webhooks, and subscriptions automatically. Runs inside your app.";

export const OG_TITLE = SITE_TITLE;
export const OG_DESCRIPTION =
  "Define plans and features in code. Handles Stripe, webhooks, and usage state. Runs inside your app, writes to your database. Open source.";

export const URLs = {
  site: "https://paykit.sh",
  githubOrg: "https://github.com/getpaykit",
  githubRepo: "https://github.com/getpaykit/paykit",
  roadmap: "https://github.com/orgs/getpaykit/projects/1",
  x: "https://x.com/paykit_sh",
  linkedin: "https://www.linkedin.com/company/paykit-sh",
  discord: "https://discord.gg/nzy9NPpFNU",
  authorGitHub: "https://github.com/maxktz",
  authorX: "https://x.com/maxktz",
  changelog: "https://paykit.sh/changelog",
} as const;

export const VERSION_TEXT = "v0.1 beta";

export const websiteSchema: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${URLs.site}/#website`,
  name: SITE_NAME,
  url: URLs.site,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
};

export const organizationSchema: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${URLs.site}/#organization`,
  name: SITE_NAME,
  url: URLs.site,
  logo: `${URLs.site}/favicon/android-chrome-512x512.png`,
  sameAs: [URLs.githubOrg, URLs.githubRepo, URLs.x, URLs.linkedin],
};

export const softwareApplicationSchema: WithContext<SoftwareApplication> = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${URLs.site}/#software`,
  name: SITE_NAME,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  url: URLs.site,
  description: SITE_DESCRIPTION,
  image: `${URLs.site}${OG_IMAGE_PATH}`,
  publisher: {
    "@id": `${URLs.site}/#organization`,
  },
};

export const faqSchema: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${URLs.site}/#faq`,
  mainEntity: [],
};

export const homePageStructuredData = [
  websiteSchema,
  organizationSchema,
  softwareApplicationSchema,
  faqSchema,
];
