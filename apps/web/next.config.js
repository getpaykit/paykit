import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

import "./src/env.js";

const withMDX = createMDX();
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../..");
const remixLucideShim = join(currentDir, "src/lib/lucide-react-remix-shim.ts");

const docsRedirects = [
  { source: "/docs", destination: "/docs/introduction", permanent: true },
  { source: "/docs/get-started", destination: "/docs/introduction", permanent: true },
  { source: "/docs/get-started/installation", destination: "/docs/installation", permanent: true },
  { source: "/docs/get-started/quickstart", destination: "/docs/quickstart", permanent: true },
  {
    source: "/docs/concepts/plans-and-features",
    destination: "/docs/plans-and-features",
    permanent: true,
  },
  { source: "/docs/concepts/customers", destination: "/docs/customers", permanent: true },
  { source: "/docs/concepts/subscriptions", destination: "/docs/subscriptions", permanent: true },
  { source: "/docs/concepts/entitlements", destination: "/docs/entitlements", permanent: true },
  { source: "/docs/concepts/webhook-events", destination: "/docs/webhook-events", permanent: true },
  { source: "/docs/concepts/database", destination: "/docs/database", permanent: true },
  { source: "/docs/concepts/plugins", destination: "/docs/plugins", permanent: true },
  { source: "/docs/concepts/client", destination: "/docs/client", permanent: true },
  { source: "/docs/concepts/cli", destination: "/docs/cli", permanent: true },
  { source: "/docs/concepts/typescript", destination: "/docs/typescript", permanent: true },
  {
    source: "/docs/flows/subscription-billing",
    destination: "/docs/subscription-billing",
    permanent: true,
  },
  { source: "/docs/flows/metered-usage", destination: "/docs/metered-usage", permanent: true },
  { source: "/docs/plugins/dashboard", destination: "/docs/dashboard", permanent: true },
  { source: "/docs/guides/skills", destination: "/docs/skills", permanent: true },
];

/** @type {import("next").NextConfig} */
const config = {
  devIndicators: {
    position: "bottom-right",
  },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "lucide-react": "./src/lib/lucide-react-remix-shim.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias["lucide-react"] = remixLucideShim;
    return config;
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-tabs",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-checkbox",
    ],
  },
  redirects: async () => [
    ...docsRedirects,
    { source: "/github", destination: "https://github.com/getpaykit/paykit", permanent: false },
    { source: "/discord", destination: "https://discord.gg/nzy9NPpFNU", permanent: false },
    { source: "/x", destination: "https://x.com/paykit_sh", permanent: false },
    {
      source: "/linkedin",
      destination: "https://www.linkedin.com/company/paykit-sh",
      permanent: false,
    },
    {
      source: "/roadmap",
      destination: "https://github.com/orgs/getpaykit/projects/1",
      permanent: false,
    },
    { source: "/donate", destination: "/sponsor", permanent: true },
    { source: "/sponsors", destination: "/sponsor", permanent: true },
  ],
};

export default withMDX(config);
