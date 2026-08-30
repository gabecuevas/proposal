import { describe, expect, it } from "vitest";
import {
  firstContactDetailsError,
  validateEmail,
  validatePersonName,
  validatePhone,
  validateTitle,
  validateWebsite,
} from "../contact-field-validation";

describe("contact field validation", () => {
  it("requires a real email address", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("not-an-email")).toBe("Enter a valid email address");
    expect(validateEmail("chase@example.com")).toBeNull();
  });

  it("allows blank phone numbers and rejects short or letter values", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("4088472424")).toBeNull();
    expect(validatePhone("+1 (408) 847-2424")).toBeNull();
    expect(validatePhone("abc")).toBe("Enter a valid phone number");
    expect(validatePhone("123")).toBe("Enter a valid phone number");
  });

  it("requires a readable name", () => {
    expect(validatePersonName("", "First name")).toBe("First name is required");
    expect(validatePersonName("Ada", "First name")).toBeNull();
    expect(validatePersonName("O'Neil", "Last name")).toBeNull();
    expect(validatePersonName("ada@site.com", "First name")).toBe("Enter a valid first name");
  });

  it("treats title as optional", () => {
    expect(validateTitle("")).toBeNull();
    expect(validateTitle("VP, Sales")).toBeNull();
  });

  it("accepts websites with or without a protocol", () => {
    expect(validateWebsite("")).toBeNull();
    expect(validateWebsite("example.com")).toBeNull();
    expect(validateWebsite("https://example.com")).toBeNull();
    expect(validateWebsite("not a url")).toBe("Enter a valid website");
  });

  it("returns the first contact-details error for create", () => {
    expect(
      firstContactDetailsError({
        first_name: "Ada",
        last_name: "Lovelace",
        email: "bad",
        phone: "",
      }),
    ).toBe("Enter a valid email address");
  });

  it("only validates fields present on a patch", () => {
    expect(firstContactDetailsError({ phone: "abc" })).toBe("Enter a valid phone number");
    expect(firstContactDetailsError({ phone: "" })).toBeNull();
    expect(firstContactDetailsError({})).toBeNull();
  });
});
