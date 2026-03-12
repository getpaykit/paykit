import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  copy: [
    {
      flatten: false,
      from: "src/database/*/migrations/**/*",
    },
  ],
  deps: {
    onlyAllowBundle: false,
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
    "handlers/next/index": "src/handlers/next-js/index.ts",
  },
  fixedExtension: false,
  format: "esm",
  outDir: "dist",
  platform: "node",
  target: "node22",
  unbundle: true,
});
