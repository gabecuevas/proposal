import { describe, expect, it } from "vitest";
import { renderBodyHtmlToPdf } from "../render-pdf";

describe("renderBodyHtmlToPdf", () => {
  it("returns a PDF buffer for simple print HTML", async () => {
    const pdf = await renderBodyHtmlToPdf({
      bodyHtml: "<article><h1>Contract</h1><p>Rendered for download.</p></article>",
      pageSize: "letter",
      title: "Contract",
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  }, 30_000);
});
