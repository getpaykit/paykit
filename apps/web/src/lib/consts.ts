import type { FAQPage, Organization, SoftwareApplication, WebSite, WithContext } from "schema-dts";

import { env } from "@/env";

export const OG_IMAGE_PATH = "/brand/og.png";
export const SITE_NAME = "PayKit";

export const SITE_TITLE = "PayKit – Stripe billing framework for TypeScript";
export const SITE_DESCRIPTION =
  "Build Stripe billing in TypeScript without the glue code. Define plans in code while PayKit handles subscriptions, webhooks, entitlements, and usage.";

export const OG_TITLE = SITE_TITLE;
export const OG_DESCRIPTION =
  "Define plans in code. PayKit handles Stripe subscriptions, webhooks, entitlements, and usage while billing state stays in your database.";

export const URLs = {
  site: env.NEXT_PUBLIC_APP_URL,
  githubOrg: "https://github.com/getpaykit",
  githubRepo: "https://github.com/getpaykit/paykit",
  roadmap: "https://github.com/orgs/getpaykit/projects/1",
  x: "https://x.com/paykit_sh",
  linkedin: "https://www.linkedin.com/company/paykit-sh",
  discord: "https://discord.gg/nzy9NPpFNU",
  authorGitHub: "https://github.com/maxktz",
  authorX: "https://x.com/maxktz",
} as const;

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
