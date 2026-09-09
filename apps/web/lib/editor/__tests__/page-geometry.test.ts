import { describe, expect, it } from "vitest";
import {
  pageCountForHeight,
  pageCountForPaperHeight,
  pageAtVisualOffset,
  pageSizeFromDoc,
  pageSizeSpec,
  pageThumbContentTransform,
  pageThumbHeightPx,
  parsePageSize,
  stackedPaperHeightPx,
  visualTopForPage,
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

  it("counts stacked sheets that include the editor page gap", () => {
    expect(pageCountForPaperHeight(1056, 1056, 32)).toBe(1);
    expect(pageCountForPaperHeight(1056 * 2 + 32, 1056, 32)).toBe(2);
    expect(pageAtVisualOffset(1056 + 10, 1056, 32)).toBe(1);
    expect(visualTopForPage(1, 1056, 32)).toBe(1088);
    expect(stackedPaperHeightPx(1, 1056, 32)).toBe(1056);
    expect(stackedPaperHeightPx(2, 1056, 32)).toBe(1056 * 2 + 32);
  });

  it("clips each document-preview thumbnail to one sheet, including page 2+", () => {
    const scale = 120 / 816;
    expect(pageThumbHeightPx(120, 816, 1056)).toBe(155);
    expect(pageThumbContentTransform(0, 1056, 32, scale)).toBe(`scale(${scale}) translateY(0px)`);
    expect(pageThumbContentTransform(1, 1056, 32, scale)).toBe(`scale(${scale}) translateY(-1088px)`);
    expect(pageThumbContentTransform(2, 1056, 32, scale)).toBe(`scale(${scale}) translateY(-2176px)`);
  });
});
