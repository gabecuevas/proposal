/**
 * Helpers for reading PaginationPlus page chrome from the editor DOM.
 * Decorative gaps alone are not proof of correct content splitting.
 */

/** Count PaginationPlus page widgets (`.rm-page-break` under `[data-rm-pagination]`). */
export function measurePaginationPlusPageCount(root: ParentNode | null | undefined): number {
  if (!root) {
    return 0;
  }
  const pagination = root.querySelector("[data-rm-pagination]");
  if (!pagination) {
    return 0;
  }
  return pagination.querySelectorAll(":scope > .rm-page-break").length;
}

/** Count explicit Flow `pageBreak` nodes rendered in the document. */
export function measureExplicitPageBreakNodes(root: ParentNode | null | undefined): number {
  if (!root) {
    return 0;
  }
  return root.querySelectorAll("[data-flow-page-break], .flow-page-break").length;
}
