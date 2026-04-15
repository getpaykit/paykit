import { describe, expect, it } from "vitest";

import { defineErrorCodes } from "../error-codes";
import { PayKitError, PAYKIT_ERROR_CODES } from "../errors";

describe("core/error-codes", () => {
  describe("defineErrorCodes", () => {
    it("produces an object keyed by error code with code and message", () => {
      const codes = defineErrorCodes({
        NOT_FOUND: "Resource not found",
        INVALID_INPUT: "Input is invalid",
      });

      expect(codes.NOT_FOUND).toEqual(
        expect.objectContaining({ code: "NOT_FOUND", message: "Resource not found" }),
      );
      expect(codes.INVALID_INPUT).toEqual(
        expect.objectContaining({ code: "INVALID_INPUT", message: "Input is invalid" }),
      );
    });

    it("toString returns the code string", () => {
      const codes = defineErrorCodes({ MY_CODE: "some message" });
      expect(String(codes.MY_CODE)).toBe("MY_CODE");
    });
  });

  describe("PAYKIT_ERROR_CODES", () => {
    it("includes expected error codes", () => {
      expect(PAYKIT_ERROR_CODES.CUSTOMER_NOT_FOUND.code).toBe("CUSTOMER_NOT_FOUND");
      expect(PAYKIT_ERROR_CODES.PLAN_NOT_FOUND.code).toBe("PLAN_NOT_FOUND");
      expect(PAYKIT_ERROR_CODES.PROVIDER_REQUIRED.code).toBe("PROVIDER_REQUIRED");
    });
  });

  describe("PayKitError", () => {
    it("sets name, code, and message from a RawError", () => {
      const raw = PAYKIT_ERROR_CODES.CUSTOMER_NOT_FOUND;
      const error = new PayKitError("BAD_REQUEST", raw);

      expect(error.name).toBe("PayKitError");
      expect(error.code).toBe("CUSTOMER_NOT_FOUND");
      expect(error.message).toBe("Customer not found");
    });

    it("allows overriding the message", () => {
      const raw = PAYKIT_ERROR_CODES.PLAN_NOT_FOUND;
      const error = new PayKitError("NOT_FOUND", raw, "Plan 'pro' does not exist");

      expect(error.code).toBe("PLAN_NOT_FOUND");
      expect(error.message).toBe("Plan 'pro' does not exist");
    });

    it("can be constructed via the static from helper", () => {
      const error = PayKitError.from("INTERNAL_SERVER_ERROR", PAYKIT_ERROR_CODES.PROVIDER_REQUIRED);

      expect(error).toBeInstanceOf(PayKitError);
      expect(error.code).toBe("PROVIDER_REQUIRED");
    });
  });
});
