import { describe, expect, it } from "vitest";

import { generateId } from "../utils";

describe("core/utils", () => {
  describe("generateId", () => {
    it("returns a string with the given prefix followed by an underscore", () => {
      const id = generateId("cus");
      expect(id).toMatch(/^cus_/u);
    });

    it("uses a default random segment length of 24", () => {
      const id = generateId("cus");
      const random = id.slice("cus_".length);
      expect(random).toHaveLength(24);
    });

    it("respects a custom random segment length", () => {
      const id = generateId("pk", 12);
      const random = id.slice("pk_".length);
      expect(random).toHaveLength(12);
    });

    it("only contains alphanumeric characters in the random segment", () => {
      for (let i = 0; i < 20; i++) {
        const id = generateId("t", 48);
        const random = id.slice("t_".length);
        expect(random).toMatch(/^[0-9A-Za-z]+$/u);
      }
    });

    it("produces unique values across calls", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId("u")));
      expect(ids.size).toBe(100);
    });
  });
});
