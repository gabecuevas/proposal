import { describe, expect, it } from "vitest";
import {
  pageCountForHeight,
  pageSizeFromDoc,
  pageSizeSpec,
  parsePageSize,
} from "../page-geometry";

describe("page sizes", () => {
  it("defaults unknown values to US Letter", () => {
    expect(parsePageSize("wide")).toBe("letter");
    expect(pageSizeFromDoc({})).toBe("letter");
    expect(pageSizeFromDoc({ attrs: { pageSize: "a4" } })).toBe("a4");
  });

  it("uses CSS-pixel dimensions at 96dpi", () => {
    expect(pageSizeSpec("letter")).toMatchObject({ widthPx: 816, heightPx: 1056, marginPx: 48 });
    expect(pageSizeSpec("legal").heightPx).toBeGreaterThan(pageSizeSpec("letter").heightPx);
    expect(pageSizeSpec("a4").widthPx).toBeLessThan(pageSizeSpec("letter").widthPx);
    expect(pageSizeSpec("a4").marginPx).toBe(48);
    expect(pageSizeSpec("legal").marginPx).toBe(48);
  });

  it("counts overflow pages from content height", () => {
    expect(pageCountForHeight(0)).toBe(1);
    expect(pageCountForHeight(1056)).toBe(1);
    expect(pageCountForHeight(1057)).toBe(2);
    expect(pageCountForHeight(2000, 1000)).toBe(2);
  });
});
