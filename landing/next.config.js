import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import "./src/env.js";

const withMDX = createMDX();
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "..");

/** @type {import("next").NextConfig} */
const config = {
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default withMDX(config);
