import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Cap parallel workers — Stripe test mode rate-limits at 25 ops/sec; too many
    // workers starting syncProducts simultaneously trips it. Paired with Stripe
    // SDK maxNetworkRetries for headroom.
    maxWorkers: 6,
    projects: [
      {
        test: {
          name: "core",
          env: { NODE_ENV: "production" },
          globalSetup: ["./test-utils/hub.ts"],
          hookTimeout: 180_000,
          include: ["core/**/*.test.ts"],
          testTimeout: 600_000,
        },
      },
      {
        test: {
          name: "cli",
          env: { NODE_ENV: "production" },
          hookTimeout: 60_000,
          include: ["cli/**/*.test.ts"],
          sequence: { concurrent: false },
          testTimeout: 120_000,
        },
      },
    ],
  },
});
