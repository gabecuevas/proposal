import { describe, expect, test } from "vitest";
import { slugifyWorkspaceName, validateCompanyWebsite } from "../company-website";

describe("validateCompanyWebsite", () => {
  test("accepts bare domains", () => {
    const result = validateCompanyWebsite("acme.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.href).toBe("https://acme.com");
    }
  });

  test("rejects localhost", () => {
    const result = validateCompanyWebsite("http://localhost:3000");
    expect(result.ok).toBe(false);
  });
});

describe("slugifyWorkspaceName", () => {
  test("avoids reserved slugs", () => {
    expect(slugifyWorkspaceName("App")).toBe("app-co");
  });
});
