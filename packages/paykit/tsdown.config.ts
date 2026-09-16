import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

import { preparePackageDist } from "../../scripts/prepare-package-dist.ts";

export default defineConfig({
  clean: true,
  copy: [
    {
      flatten: false,
      from: "src/database/migrations/**/*",
    },
  ],
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
    "handlers/next": "src/handlers/next.ts",
    "client/index": "src/client/index.ts",
  },
  fixedExtension: false,
  format: "esm",
  onSuccess: async () => {
    await preparePackageDist(fileURLToPath(new URL(".", import.meta.url)));
  },
  outDir: "dist",
  platform: "node",
  target: "node22",
  unbundle: true,
});
