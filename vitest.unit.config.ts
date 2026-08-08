import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ["paykit-source"],
    },
  },
  test: {
    environment: "node",
    exclude: ["**/dist/**", "**/node_modules/**", "e2e/**"],
    include: ["packages/**/__tests__/**/*.test.ts", "apps/web/**/__tests__/**/*.test.ts"],
  },
});
