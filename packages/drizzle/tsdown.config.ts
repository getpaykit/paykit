import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    onlyAllowBundle: false,
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: {
    index: "src/index.ts",
  },
  fixedExtension: false,
  format: "esm",
  outDir: "dist",
  platform: "node",
  target: "node22",
  unbundle: true,
});
