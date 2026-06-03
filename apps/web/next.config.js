import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

import "./src/env.js";

const withMDX = createMDX();
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../..");

/** @type {import("next").NextConfig} */
const config = {
  devIndicators: {
    position: "bottom-right",
  },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
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
  ],
};

export default withMDX(config);
