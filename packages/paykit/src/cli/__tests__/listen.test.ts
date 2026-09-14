import { describe, expect, it } from "vitest";

import {
  buildLocalWebhookUrl,
  buildShellCommand,
  getNextErrorBackoff,
  isReplacedSessionClose,
  normalizeLocalOrigin,
  parseDeliveryDetails,
  parseRetryWindowMs,
  sanitizeReplayHeaders,
} from "../commands/listen";

describe("cli/listen", () => {
  it.each([
    ["0", 0],
    ["none", 0],
    ["500ms", 500],
    ["30s", 30_000],
    ["5m", 300_000],
    ["1h", 3_600_000],
    ["5", 300_000],
    [" 30S ", 30_000],
  ])("parses retry window %s", (value, expected) => {
    expect(parseRetryWindowMs(value)).toBe(expected);
  });

  it.each(["-1", "1d", "soon", "1.5m", ""])("rejects retry window %s", (value) => {
    expect(() => parseRetryWindowMs(value)).toThrow("--retry must look like");
  });

  it("normalizes a local forwarding origin", () => {
    expect(normalizeLocalOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it.each([
    "http://localhost:3000/api",
    "http://localhost:3000/?debug=true",
    "http://localhost:3000/#debug",
  ])("rejects non-origin forwarding URL %s", (url) => {
    expect(() => normalizeLocalOrigin(url)).toThrow("--forward-to must be an origin only");
  });

  it("builds the webhook URL from the configured base path", () => {
    expect(buildLocalWebhookUrl("http://localhost:3000", "/billing")).toBe(
      "http://localhost:3000/billing/webhook",
    );
  });

  it("extracts display details from a provider event", () => {
    expect(parseDeliveryDetails('{"id":"evt_123","type":"invoice.paid"}')).toEqual({
      eventId: "evt_123",
      eventType: "invoice.paid",
    });
  });

  it.each(["not json", "null", "[]", '{"id":1,"type":false}'])(
    "tolerates malformed delivery body %s",
    (body) => {
      expect(parseDeliveryDetails(body)).toEqual({});
    },
  );

  it("removes transport headers and marks replayed requests", () => {
    const headers = sanitizeReplayHeaders({
      Connection: "keep-alive, X-Internal-Transport",
      "Content-Length": "100",
      Host: "example.com",
      "Keep-Alive": "timeout=5",
      "Stripe-Signature": "signature",
      TE: "trailers",
      "Transfer-Encoding": "chunked",
      Upgrade: "websocket",
      "X-Internal-Transport": "remove-me",
    });

    expect(Object.fromEntries(headers)).toEqual({
      "stripe-signature": "signature",
      "x-paykit-cloud-replay": "1",
    });
  });

  it.each([
    [0, 2000],
    [2000, 4000],
    [8000, 15_000],
    [15_000, 15_000],
  ])("backs off from %i ms to %i ms", (current, expected) => {
    expect(getNextErrorBackoff(current)).toBe(expected);
  });

  it("recognizes sessions replaced by a newer listener", () => {
    expect(isReplacedSessionClose({ code: 4001 })).toBe(true);
    expect(isReplacedSessionClose({ code: 1000, reason: "normal" })).toBe(false);
  });

  it("quotes shell arguments without changing safe arguments", () => {
    expect(buildShellCommand(["pnpm", "run", "dev"])).toBe("pnpm run dev");
    expect(buildShellCommand(["node", "path with spaces/app.js"])).toBe(
      "node 'path with spaces/app.js'",
    );
    expect(buildShellCommand(["node", "it's-safe.js"])).toBe("node 'it'\\''s-safe.js'");
  });
});
