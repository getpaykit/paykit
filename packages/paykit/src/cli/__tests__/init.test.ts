import { describe, expect, it } from "vitest";

import { getWebhookListenCommand } from "../commands/init";

describe("cli/init", () => {
  it("uses paykitjs listen when the PayKit CLI is available", () => {
    expect(getWebhookListenCommand(3000, true)).toBe(
      "paykitjs listen --forward-to localhost:3000/paykit/webhook",
    );
  });

  it("falls back to stripe listen when the PayKit CLI is unavailable", () => {
    expect(getWebhookListenCommand(3000, false)).toBe(
      "stripe listen --forward-to localhost:3000/paykit/webhook",
    );
  });
});
