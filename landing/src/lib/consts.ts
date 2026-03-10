import type { FAQPage, Organization, SoftwareApplication, WebSite, WithContext } from "schema-dts";

export const OG_IMAGE_PATH = "/opengraph-image";
export const SITE_NAME = "PayKit";
export const SITE_TITLE = "PayKit | Open-source payment orchestration for TypeScript";
export const SITE_DESCRIPTION =
  "Open-source payment orchestration for TypeScript apps. Run hosted checkout, saved methods, charges, and provider webhooks through one API while your own database stays the source of truth.";
export const URLs = {
  site: "https://paykit.sh",
  githubOrg: "https://github.com/getpaykit",
  githubRepo: "https://github.com/getpaykit/paykit",
  roadmap: "https://github.com/orgs/getpaykit/projects/1",
  x: "https://x.com/getpaykit",
  linkedin: "https://www.linkedin.com/company/getpaykit",
  discord: "https://discord.gg/paykit",
  authorGitHub: "https://github.com/maxktz",
  authorX: "https://x.com/maxk4tz",
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
  mainEntity: [
    {
      "@type": "Question",
      name: "What is PayKit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PayKit is an open-source payment orchestration framework for TypeScript apps that gives you one API for checkout, saved methods, charges, and provider webhooks.",
      },
    },
    {
      "@type": "Question",
      name: "Does PayKit process payments?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. PayKit sits between your app and payment providers so you can keep billing state and business logic on your side.",
      },
    },
  ],
};

export const homePageStructuredData = [
  websiteSchema,
  organizationSchema,
  softwareApplicationSchema,
  faqSchema,
];
