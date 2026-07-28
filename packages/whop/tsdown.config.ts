import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

import { createPackageTsdownConfig } from "../../tsdown.base.ts";

export default defineConfig(
  createPackageTsdownConfig({
    packageRoot: fileURLToPath(new URL(".", import.meta.url)),
    entry: {
      index: "src/index.ts",
    },
  }),
);
