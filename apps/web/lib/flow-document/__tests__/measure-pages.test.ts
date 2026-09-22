/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  measureExplicitPageBreakNodes,
  measurePaginationPlusPageCount,
} from "../measure-pages";

describe("measure-pages", () => {
  it("counts PaginationPlus page widgets under data-rm-pagination", () => {
    document.body.innerHTML = `
      <div class="ProseMirror">
        <div data-rm-pagination id="pages">
          <div class="rm-page-break"></div>
          <div class="rm-page-break"></div>
          <div class="rm-page-break"></div>
        </div>
      </div>
    `;
    expect(measurePaginationPlusPageCount(document.body)).toBe(3);
  });

  it("counts explicit flow page break nodes", () => {
    document.body.innerHTML = `
      <div>
        <div data-flow-page-break class="flow-page-break"></div>
        <div class="flow-page-break"></div>
      </div>
    `;
    expect(measureExplicitPageBreakNodes(document.body)).toBe(2);
  });
});
