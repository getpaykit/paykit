import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shouldAllowUnsignedPayload } from "../webhook.api";

// shouldAllowUnsignedPayload gates whether the public webhook endpoint skips
// Stripe signature verification entirely. It must only ever be true because
// an operator explicitly opted in, never because of the server's ambient
// NODE_ENV - see the comment on the function for why.
describe("shouldAllowUnsignedPayload", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PAYKIT_ALLOW_UNSIGNED_PAYLOADS;
    delete process.env.PAYKIT_ALLOW_STALE_SIGNATURES;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires the cloud-replay header even with an explicit opt-in", () => {
    process.env.PAYKIT_ALLOW_UNSIGNED_PAYLOADS = "1";
    expect(shouldAllowUnsignedPayload(new Headers())).toBe(false);
  });

  it("does not allow unsigned payloads from NODE_ENV=development alone", () => {
    process.env.NODE_ENV = "development";
    const headers = new Headers({ "x-paykit-cloud-replay": "1" });
    expect(shouldAllowUnsignedPayload(headers)).toBe(false);
  });

  it("does not allow unsigned payloads from NODE_ENV=test alone", () => {
    process.env.NODE_ENV = "test";
    const headers = new Headers({ "x-paykit-cloud-replay": "1" });
    expect(shouldAllowUnsignedPayload(headers)).toBe(false);
  });

  it("allows unsigned payloads with the documented opt-in flag", () => {
    process.env.PAYKIT_ALLOW_UNSIGNED_PAYLOADS = "1";
    const headers = new Headers({ "x-paykit-cloud-replay": "1" });
    expect(shouldAllowUnsignedPayload(headers)).toBe(true);
  });

  it("allows unsigned payloads with the legacy alias flag", () => {
    process.env.PAYKIT_ALLOW_STALE_SIGNATURES = "1";
    const headers = new Headers({ "x-paykit-cloud-replay": "1" });
    expect(shouldAllowUnsignedPayload(headers)).toBe(true);
  });
});
