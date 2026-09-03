import { describe, expect, it } from "vitest";
import { normalizeWebsite, websiteHref } from "../website";

describe("website helpers", () => {
  it("normalizes bare domains to www format", () => {
    expect(normalizeWebsite("example.com")).toBe("www.example.com");
    expect(normalizeWebsite("https://example.com")).toBe("www.example.com");
    expect(normalizeWebsite("http://www.example.com/path")).toBe("www.example.com/path");
  });

  it("keeps subdomains without forcing www", () => {
    expect(normalizeWebsite("docs.example.com")).toBe("docs.example.com");
  });

  it("builds clickable hrefs", () => {
    expect(websiteHref("www.example.com")).toBe("https://www.example.com");
    expect(websiteHref("https://example.com")).toBe("https://example.com");
  });
});
