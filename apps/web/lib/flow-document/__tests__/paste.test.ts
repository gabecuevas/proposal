/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { sanitizeFlowPastedHtml } from "../paste";

describe("sanitizeFlowPastedHtml", () => {
  it("keeps tables and column widths from Docs-style class CSS", () => {
    const html = `
      <html><head><style>
        .c0{width:176.3pt;vertical-align:top;padding:3.6pt}
        .c1{width:327.7pt;vertical-align:top}
      </style></head><body>
      <table>
        <tr>
          <td class="c0"><p><span style="font-size:24pt;font-weight:700">Your Name</span></p></td>
          <td class="c1"><p>Contact</p></td>
        </tr>
      </table>
      </body></html>
    `;
    const clean = sanitizeFlowPastedHtml(html);
    expect(clean.toLowerCase()).toContain("<table");
    expect(clean.toLowerCase()).toContain("<td");
    expect(clean).toContain("Your Name");
    expect(clean).toContain("Contact");
    expect(clean).toMatch(/width:\s*\d+(\.\d+)?%/i);
    expect(clean).toMatch(/vertical-align:\s*top/i);
    expect(clean).not.toMatch(/class="/);
  });

  it("still converts Docs horizontal-line images to hr", () => {
    const html = `<p><img title="horizontal line" src="data:image/png;base64,aaa"></p>`;
    const clean = sanitizeFlowPastedHtml(html);
    expect(clean).toContain("<hr");
    expect(clean).not.toContain("<img");
  });

  it("converts absolute Docs column widths to percentages so columns fit the page", () => {
    const html = `
      <html><head><style>
        .c0{width:176.3pt;border-width:0pt}
        .c1{width:327.7pt;border-width:0pt}
      </style></head><body>
      <table><tr>
        <td class="c0"><p>Left</p></td>
        <td class="c1"><p>Right</p></td>
      </tr></table>
      </body></html>
    `;
    const clean = sanitizeFlowPastedHtml(html);
    expect(clean).toMatch(/width:\s*34\.9\d*%/i);
    expect(clean).toMatch(/width:\s*65\.0\d*%/i);
  });

  it("does not invent black borders on borderless Docs cells", () => {
    const html = `
      <html><head><style>
        .c0{border-width:0pt;border-style:solid;width:176.3pt}
        .c1{border-width:0pt;width:327.7pt}
      </style></head><body>
      <table><tr>
        <td class="c0"><p>Left</p></td>
        <td class="c1"><p>Right</p></td>
      </tr></table>
      </body></html>
    `;
    const clean = sanitizeFlowPastedHtml(html);
    expect(clean).toMatch(/width:\s*\d/i);
    expect(clean.toLowerCase()).toMatch(/border-width:\s*0pt|border:\s*0/i);
    expect(clean).not.toMatch(/border:\s*1pt\s+solid\s+#000/i);
  });
});
