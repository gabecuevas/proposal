/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { clampPasteLineHeight, isPastePageFooterText, normalizeFontSize, sanitizePastedHtml } from "../paste";

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

  it("strips layout styles that throw off pagination", () => {
    const html = `<p style="margin: 48px; width: 900px; position: absolute; top: 12px; font-weight: 700; color: #111">Hello</p>`;
    const clean = sanitizePastedHtml(html);
    expect(clean).toContain("font-weight");
    expect(clean).toContain("color");
    expect(clean).not.toContain("position");
    expect(clean).not.toContain("width");
    expect(clean).not.toContain("margin");
  });

  it("normalizes Google Docs font sizes and drops class noise", () => {
    const html = `<p class="c1"><span style="font-size: 11pt; font-family: Arial;">Proposal</span></p>`;
    const clean = sanitizePastedHtml(html);
    expect(clean).not.toContain('class="');
    expect(clean).toContain("font-size: 15px");
    expect(clean).toContain("Proposal");
  });

  it("forces pasted images to fit the page width", () => {
    const html = `<img src="https://example.com/a.png" width="2400" height="1800" style="width: 2400px; height: 1800px;">`;
    const clean = sanitizePastedHtml(html);
    expect(clean).toContain("max-width: 100%");
    expect(clean).not.toContain('width="2400"');
    expect(clean).not.toContain("2400px");
  });

  it("strips absolute table widths", () => {
    const html = `<table width="1200"><tr><td width="600" style="width: 600px;">Cell</td></tr></table>`;
    const clean = sanitizePastedHtml(html);
    expect(clean).toContain("Cell");
    expect(clean).not.toContain('width="1200"');
    expect(clean).not.toContain("600px");
  });

  it("strips pasted Page N of N footers from Word/PDF", () => {
    const html = `<p>Body text</p><p style="text-align: right;"><span style="font-size: 12px;">Page 1 of 3&nbsp;</span></p><p>More body</p><p style="text-align: center;"><span>Copyright © 2020 by Example.com Page 3 of 3&nbsp;</span></p>`;
    const clean = sanitizePastedHtml(html);
    expect(clean).toContain("Body text");
    expect(clean).toContain("More body");
    expect(clean).not.toMatch(/Page\s+1\s+of\s+3/i);
    expect(clean).not.toMatch(/Page\s+3\s+of\s+3/i);
  });

  it("clamps extreme signature line-heights from paste", () => {
    const html = `<p data-line-height="3.43779" style="line-height: 3.43779;"><strong>Party A’s Signature</strong> ________</p>`;
    const clean = sanitizePastedHtml(html);
    expect(clean).toContain("line-height: 2");
    expect(clean).not.toContain("3.43779");
    expect(clean).toContain('data-line-height="2"');
  });
});

describe("isPastePageFooterText", () => {
  it("detects common page markers", () => {
    expect(isPastePageFooterText("Page 1 of 3")).toBe(true);
    expect(isPastePageFooterText("Page 2 of 3\u00a0")).toBe(true);
    expect(isPastePageFooterText("Copyright © 2020 by NonDisclosureAgreements.com Page 3 of 3")).toBe(true);
    expect(isPastePageFooterText("NOW, THEREFORE, the Parties agree as follows:")).toBe(false);
  });
});

describe("clampPasteLineHeight", () => {
  it("caps extreme unitless line-heights", () => {
    expect(clampPasteLineHeight("3.43779")).toBe("2");
    expect(clampPasteLineHeight("1.2")).toBe("1.2");
  });
});

describe("normalizeFontSize", () => {
  it("converts points to a clamped pixel size", () => {
    expect(normalizeFontSize("11pt")).toBe("15px");
    expect(normalizeFontSize("72pt")).toBe("48px");
    expect(normalizeFontSize("6px")).toBe("10px");
  });
});
