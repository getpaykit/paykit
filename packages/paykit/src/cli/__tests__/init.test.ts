import { describe, expect, it } from "vitest";

import { getPaykitListenCommand, getStripeListenCommand } from "../commands/init";

describe("cli/init", () => {
  it("uses paykitjs listen when the PayKit CLI is available", () => {
    expect(getPaykitListenCommand("pnpm")).toBe("pnpm paykitjs listen -- pnpm dev");
    expect(getPaykitListenCommand("npm")).toBe("npx paykitjs listen -- npm run dev");
  });

  it("falls back to stripe listen when the PayKit CLI is unavailable", () => {
    expect(getStripeListenCommand(3000)).toBe(
      "stripe listen --forward-to localhost:3000/paykit/webhook",
    );
  });
});
