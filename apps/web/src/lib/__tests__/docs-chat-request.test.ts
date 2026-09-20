import { describe, expect, it } from "vitest";

import {
  DocsChatValidationError,
  parseDocsChatRequest,
  sanitizeCurrentPage,
} from "../docs-chat-request";

describe("parseDocsChatRequest", () => {
  it("keeps text history and strips assistant tool state", () => {
    const result = parseDocsChatRequest({
      currentPage: "/docs/subscriptions?tab=client#upgrade",
      messages: [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "How do upgrades work?" }] },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            { type: "tool-paykitDocs_search", toolCallId: "tool-1", state: "output-available" },
            { type: "text", text: "They take effect immediately." },
          ],
        },
      ],
      trigger: "submit-message",
    });

    expect(result.data.currentPage).toBe("/docs/subscriptions");
    expect(result.messages[1]?.parts).toEqual([
      { type: "text", text: "They take effect immediately." },
    ]);
  });

  it("drops an incomplete tool-only turn before a new user message", () => {
    const result = parseDocsChatRequest({
      messages: [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "First question" }] },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "tool-paykitDocs_search", state: "output-available" }],
        },
        { id: "user-2", role: "user", parts: [{ type: "text", text: "Second question" }] },
      ],
      trigger: "submit-message",
    });

    expect(result.messages).toEqual([
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", text: "Second question" }],
      },
    ]);
  });

  it("keeps the user prompt when regenerating a tool-only response", () => {
    const result = parseDocsChatRequest({
      messages: [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "Try again" }] },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "tool-paykitDocs_search", state: "output-available" }],
        },
      ],
      trigger: "regenerate-message",
    });

    expect(result.messages).toEqual([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Try again" }],
      },
    ]);
  });

  it("rejects non-text user content", () => {
    expect(() =>
      parseDocsChatRequest({
        messages: [{ id: "user-1", role: "user", parts: [{ type: "file", url: "x" }] }],
      }),
    ).toThrow(DocsChatValidationError);
  });

  it("reports an oversized user message accurately", () => {
    expect(() =>
      parseDocsChatRequest({
        messages: [
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "a".repeat(4_001) }],
          },
        ],
      }),
    ).toThrow("The message is too long.");
  });

  it("rejects conversations above the total character limit", () => {
    expect(() =>
      parseDocsChatRequest({
        messages: Array.from({ length: 6 }, (_, index) => ({
          id: `user-${index}`,
          role: "user",
          parts: [{ type: "text", text: "a".repeat(4_000) }],
        })),
      }),
    ).toThrow("The conversation is too long.");
  });
});

describe("sanitizeCurrentPage", () => {
  it("accepts docs paths and removes search and fragment data", () => {
    expect(sanitizeCurrentPage("/docs/entitlements?source=chat#usage")).toBe("/docs/entitlements");
  });

  it("rejects paths outside the documentation", () => {
    expect(() => sanitizeCurrentPage("/pricing")).toThrow(DocsChatValidationError);
    expect(() => sanitizeCurrentPage("https://example.com/docs/introduction")).toThrow(
      DocsChatValidationError,
    );
  });
});
