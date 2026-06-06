/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
  transpilePackages: ["paykitjs", "autumn-js"],
  serverExternalPackages: ["pg"],
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
};

export default config;
