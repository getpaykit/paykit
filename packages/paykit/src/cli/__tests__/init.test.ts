import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectPaykitCli, getPaykitListenCommand, getStripeListenCommand } from "../commands/init";

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

  it("detects the PayKit CLI from the target project", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "paykit-init-"));

    try {
      fs.writeFileSync(
        path.join(cwd, "package.json"),
        JSON.stringify({ dependencies: { paykitjs: "workspace:*" } }),
      );
      expect(detectPaykitCli(cwd)).toBe(false);

      const packageDir = path.join(cwd, "node_modules", "paykitjs");
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "paykitjs" }));
      expect(detectPaykitCli(cwd)).toBe(true);
    } finally {
      fs.rmSync(cwd, { force: true, recursive: true });
    }
  });
});
