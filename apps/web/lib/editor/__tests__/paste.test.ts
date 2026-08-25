import { describe, expect, it } from "vitest";
import { sanitizePastedHtml } from "../paste";

describe("sanitizePastedHtml", () => {
  it("strips scripts, iframes, and inline handlers", () => {
    const dirty = `<p onclick="alert(1)">Hello</p><script>alert(2)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(3)">x</a>`;
    const clean = sanitizePastedHtml(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("Hello");
  });

  it("keeps basic rich text", () => {
    const html = `<p><strong>Bold</strong> and <em>italic</em> <a href="https://example.com">link</a></p>`;
    expect(sanitizePastedHtml(html)).toContain("<strong>Bold</strong>");
    expect(sanitizePastedHtml(html)).toContain('href="https://example.com"');
  });
});
