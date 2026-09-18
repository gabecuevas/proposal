import type { Editor } from "@tiptap/core";

/** PaginationPlus enable/disable only mutates extension storage — force a view pass. */
export function forceFlowPaginationRefresh(editor: Editor): void {
  const tr = editor.state.tr.setMeta("flow-pagination-refresh", Date.now());
  editor.view.dispatch(tr);
}

export function enableFlowPagination(editor: Editor): void {
  editor.commands.enablePagination();
  editor.view.dom.style.minHeight = "";
  editor.view.dom.removeAttribute("rm-pagination-disabled");
  forceFlowPaginationRefresh(editor);
}

export function disableFlowPagination(editor: Editor): void {
  editor.commands.disablePagination();
  editor.view.dom.style.minHeight = "";
  forceFlowPaginationRefresh(editor);
}
