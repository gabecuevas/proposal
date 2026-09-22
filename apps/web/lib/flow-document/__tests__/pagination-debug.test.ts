/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sanitizePastedHtml } from "@/lib/editor/paste";
import {
  captureFlowPaginationSnapshot,
  summarizePastedHtml,
} from "@/lib/flow-document/pagination-debug";

describe("flow pagination debug helpers", () => {
  it("summarizes paste size and layout risk signals", () => {
    const raw = `<table style="width:900px"><tr><td><img title="horizontal line" src="data:image/png;base64,aaa" style="width:418px;height:2.67px;transform:rotate(0)"></td></tr></table>`;
    const clean = sanitizePastedHtml(raw);
    const summary = summarizePastedHtml(raw, clean);
    expect(summary.rawTables).toBe(1);
    expect(summary.rawImages).toBe(1);
    expect(summary.rawTransforms).toBeGreaterThan(0);
    expect(summary.cleanImages).toBe(0);
    expect(clean).toContain("<hr");
  });

  it("captures PaginationPlus gap metrics from a fake editor DOM", () => {
    document.body.innerHTML = `
      <div class="flow-document-editor" style="min-height: 2000px; --rm-page-height: 1056px; --rm-margin-top: 48px; --rm-margin-bottom: 48px; --rm-content-margin-top: 8px; --rm-content-margin-bottom: 8px;">
        <div data-rm-pagination id="pages">
          <div class="rm-page-break"><div class="page"></div><div class="breaker" style="height:20px"></div></div>
          <div class="rm-page-break"><div class="page"></div><div class="breaker" style="height:20px"></div></div>
        </div>
        <p>Body</p>
      </div>
    `;
    const snap = captureFlowPaginationSnapshot(
      document.querySelector(".flow-document-editor") as HTMLElement | null,
    );
    expect(snap?.pageCount).toBe(2);
    expect(snap?.pageContentAreaHeightPx).toBe(1056 - 48 - 48 - 8 - 8);
    expect(snap?.paragraphs).toBe(1);
  });
});

describe("google docs resume fixture paste shape", () => {
  it("strips the layout bombs from the public resume template export", () => {
    // Optional local fixture — when present, assert sanitizer removes the known risks.
    let body = "";
    try {
      body = readFileSync("/tmp/gdoc-body.html", "utf8");
    } catch {
      return;
    }
    if (!body.includes("Creative Director")) {
      return;
    }
    const clean = sanitizePastedHtml(body);
    const summary = summarizePastedHtml(body, clean);
    expect(summary.rawImages).toBeGreaterThan(0);
    expect(clean).not.toMatch(/title="horizontal line"/i);
    expect(clean.toLowerCase()).toContain("<hr");
    expect(clean).not.toMatch(/width:\s*418/i);
    expect(clean).not.toMatch(/transform:/i);
  });
});
