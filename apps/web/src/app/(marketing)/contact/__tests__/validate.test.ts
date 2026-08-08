import { describe, expect, it } from "vitest";

import { validateContactForm } from "../validate";

function form(values: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const valid = {
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme",
  message: "Hello",
};

describe("contact form validation", () => {
  it("accepts and trims a valid submission", () => {
    expect(validateContactForm(form({ ...valid, name: " Jane Doe " }))).toMatchObject({
      success: true,
      data: { name: "Jane Doe" },
    });
  });

  it.each([
    { ...valid, email: "not-an-email" },
    { ...valid, name: "X".repeat(201) },
    { ...valid, company: "Acme\r\nInjected" },
    { ...valid, message: "X".repeat(5001) },
  ])("rejects invalid or oversized fields", (values) => {
    expect(validateContactForm(form(values)).success).toBe(false);
  });

  it("rejects file fields instead of coercing them to strings", () => {
    expect(
      validateContactForm(form({ ...valid, name: new File(["Jane"], "name.txt") })).success,
    ).toBe(false);
  });
});
