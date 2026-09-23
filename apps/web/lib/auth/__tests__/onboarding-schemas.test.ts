import { describe, expect, test } from "vitest";
import { signupSchema } from "../onboarding-schemas";

describe("signupSchema", () => {
  test("requires 15 character password and terms acceptance", () => {
    const invalid = signupSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "short",
      companyName: "Analytical Engines",
      acceptTerms: true,
    });
    expect(invalid.success).toBe(false);

    const valid = signupSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "fifteen-characters!",
      companyName: "Analytical Engines",
      acceptTerms: true,
    });
    expect(valid.success).toBe(true);
  });

  test("rejects missing terms acceptance", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "fifteen-characters!",
      companyName: "Analytical Engines",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });
});
