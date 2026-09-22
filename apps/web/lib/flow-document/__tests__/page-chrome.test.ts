import { describe, expect, it } from "vitest";
import {
  chromeNeedsPerPageSlots,
  DEFAULT_FLOW_PAGE_CHROME,
  flowPageChromeFromDoc,
  parseFlowPageChrome,
  plainTextToChromeHtml,
  withFlowPageChrome,
} from "../page-chrome";

describe("flow page chrome", () => {
  it("defaults when missing", () => {
    expect(parseFlowPageChrome(undefined)).toEqual(DEFAULT_FLOW_PAGE_CHROME);
    expect(flowPageChromeFromDoc({ type: "doc", content: [] })).toEqual(DEFAULT_FLOW_PAGE_CHROME);
  });

  it("round-trips through editor doc attrs", () => {
    const chrome = {
      ...DEFAULT_FLOW_PAGE_CHROME,
      headerEnabled: true,
      headerText: "Acme Corp",
      showPageNumbers: true,
      footerEnabled: true,
      headerMarginInches: 0.75,
      differentOddEven: true,
    };
    const doc = withFlowPageChrome({ type: "doc", content: [{ type: "paragraph" }] }, chrome);
    expect(flowPageChromeFromDoc(doc)).toEqual(chrome);
  });

  it("escapes html for chrome slots", () => {
    expect(plainTextToChromeHtml('A <b> & "C"')).toBe("A &lt;b&gt; &amp; &quot;C&quot;");
    expect(plainTextToChromeHtml("line1\nline2")).toBe("line1<br/>line2");
  });

  it("only needs per-page PaginationPlus slots for layout variants", () => {
    expect(chromeNeedsPerPageSlots(DEFAULT_FLOW_PAGE_CHROME)).toBe(false);
    expect(chromeNeedsPerPageSlots({ ...DEFAULT_FLOW_PAGE_CHROME, headerEnabled: true })).toBe(false);
    expect(chromeNeedsPerPageSlots({ ...DEFAULT_FLOW_PAGE_CHROME, differentFirstPage: true })).toBe(true);
    expect(chromeNeedsPerPageSlots({ ...DEFAULT_FLOW_PAGE_CHROME, differentOddEven: true })).toBe(true);
    expect(chromeNeedsPerPageSlots({ ...DEFAULT_FLOW_PAGE_CHROME, showPageNumbers: true })).toBe(true);
  });
});
