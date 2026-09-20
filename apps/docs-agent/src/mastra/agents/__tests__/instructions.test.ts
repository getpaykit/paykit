import { describe, expect, it } from "vitest";

import { buildDocsAgentInstructions } from "../instructions";

describe("buildDocsAgentInstructions", () => {
  it("requires retrieval, citations, and grounded abstention", () => {
    const instructions = buildDocsAgentInstructions();

    expect(instructions).toContain("Call paykitDocs_search exactly once");
    expect(instructions).toContain("paykitDocs_get_page");
    expect(instructions).toContain("Never finish a run with tool calls but no answer");
    expect(instructions).toContain("fenced bash code blocks");
    expect(instructions).toContain("[Subscriptions](/docs/subscriptions)");
    expect(instructions).toContain("Never invent or prepend a hostname");
    expect(instructions).toContain("Do not guess or invent APIs");
  });

  it("adds the current page without treating it as the answer", () => {
    const instructions = buildDocsAgentInstructions("/docs/subscriptions");

    expect(instructions).toContain("currently viewing /docs/subscriptions");
    expect(instructions).toContain("do not assume it contains the answer");
  });
});
