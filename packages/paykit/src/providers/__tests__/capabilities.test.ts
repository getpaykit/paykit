import { describe, expect, it } from "vitest";

import { PAYKIT_ERROR_CODES } from "../../core/errors";
import { assertProviderCapability, unsupportedProviderCapability } from "../capabilities";

const provider = {
  capabilities: {} as never,
  id: "test",
  name: "Test Provider",
};

describe("provider/capabilities", () => {
  it("throws a stable unsupported capability error", () => {
    const error = unsupportedProviderCapability(provider, "subscriptions.schedules");

    expect(error).toMatchObject({
      code: PAYKIT_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED.code,
      message: 'Test Provider does not support provider capability "subscriptions.schedules"',
    });
  });

  it("passes when the capability is supported", () => {
    expect(() => assertProviderCapability(provider, "subscriptions.schedules", true)).not.toThrow();
  });
});
