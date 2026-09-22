/**
 * Flow page actions — insert blank / duplicate visual pages.
 */
import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { EditorNode } from "@/lib/editor/types";
import { forceFlowPaginationRefresh } from "@/lib/flow-document/pagination-control";
import { syncFlowTableColumnLayout } from "@/lib/flow-document/table-pagination";

/**
 * Insert an explicit page break + empty paragraphs after visual page `pageIndex`
 * (0-based), creating a blank sheet for PaginationPlus.
 */
export function insertBlankFlowPageAfter(
  editor: Editor,
  pageIndex: number,
  pageTopPx: number,
  pageHeightPx: number,
): boolean {
  const ok = editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      const { doc, schema } = state;
      const pageBreakType = schema.nodes.pageBreak;
      const paragraphType = schema.nodes.paragraph;
      if (!pageBreakType || !paragraphType) {
        return false;
      }

      const end = doc.content.size;
      const i = Math.max(0, Math.trunc(pageIndex));
      let insertAt = findInsertPos(editor, i, pageTopPx, pageHeightPx, end);
      insertAt = Math.max(0, Math.min(insertAt, end));

      const $at = doc.resolve(Math.min(insertAt, Math.max(0, end)));
      const isBreakBefore = $at.nodeBefore?.type.name === "pageBreak";

      const nodes = [];
      if (!isBreakBefore) {
        nodes.push(pageBreakType.create());
      }
      nodes.push(paragraphType.create());
      nodes.push(paragraphType.create());
      nodes.push(paragraphType.create());

      tr.insert(insertAt, Fragment.fromArray(nodes));
      dispatch(tr);
      return true;
    })
    .run();

  if (ok) {
    refreshPagination(editor);
  }
  return ok;
}

/**
 * Duplicate the content of visual page `pageIndex` onto a new following page.
 */
export function duplicateFlowPage(
  editor: Editor,
  pageIndex: number,
  pageTopPx: number,
  pageHeightPx: number,
): boolean {
  const ok = editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      const { doc, schema } = state;
      const pageBreakType = schema.nodes.pageBreak;
      const paragraphType = schema.nodes.paragraph;
      if (!pageBreakType || !paragraphType) {
        return false;
      }

      const end = doc.content.size;
      const i = Math.max(0, Math.trunc(pageIndex));
      const insertAt = Math.max(0, Math.min(findInsertPos(editor, i, pageTopPx, pageHeightPx, end), end));
      const blocks = collectBlocksOnPage(editor, i, pageTopPx, pageHeightPx);
      const cloned = blocks.map((block) => schema.nodeFromJSON(structuredClone(block.json)));

      const $at = doc.resolve(Math.min(insertAt, Math.max(0, end)));
      const isBreakBefore = $at.nodeBefore?.type.name === "pageBreak";
      const followingIsContent = insertAt < end;

      const nodes: PMNode[] = [];
      if (!isBreakBefore) {
        nodes.push(pageBreakType.create());
      }
      if (cloned.length) {
        nodes.push(...cloned);
      } else {
        nodes.push(paragraphType.create());
      }
      if (followingIsContent) {
        nodes.push(pageBreakType.create());
      }

      tr.insert(insertAt, Fragment.fromArray(nodes));
      dispatch(tr);
      return true;
    })
    .run();

  if (ok) {
    refreshPagination(editor);
  }
  return ok;
}

function refreshPagination(editor: Editor) {
  requestAnimationFrame(() => {
    syncFlowTableColumnLayout(editor.view.dom);
    forceFlowPaginationRefresh(editor);
  });
}

function findInsertPos(
  editor: Editor,
  pageIndex: number,
  pageTopPx: number,
  pageHeightPx: number,
  end: number,
): number {
  const doc = editor.state.doc;
  const structural = splitByPageBreaks(doc);
  if (structural.length > 1 && pageIndex < structural.length) {
    const blocks = structural[pageIndex]!;
    if (blocks.length) {
      const last = blocks[blocks.length - 1]!;
      let pos = last.pos + last.size;
      const next = doc.nodeAt(pos);
      if (next?.type.name === "pageBreak") {
        pos += next.nodeSize;
      }
      return Math.min(pos, end);
    }
  }

  const dom = editor.view.dom as HTMLElement;
  const rect = dom.getBoundingClientRect();
  const scale = dom.offsetHeight > 0 ? rect.height / dom.offsetHeight : 1;
  const safeScale = scale > 0.01 ? scale : 1;
  const clientY = rect.top + (pageTopPx + pageHeightPx - 8) * safeScale;
  const clientX = rect.left + rect.width / 2;
  const hit = editor.view.posAtCoords({ left: clientX, top: clientY });
  if (hit) {
    const $pos = doc.resolve(hit.pos);
    return Math.min($pos.after(Math.max(1, $pos.depth)), end);
  }

  return end;
}

function collectBlocksOnPage(
  editor: Editor,
  pageIndex: number,
  pageTopPx: number,
  pageHeightPx: number,
): { pos: number; size: number; json: EditorNode }[] {
  const structural = splitByPageBreaks(editor.state.doc);
  if (structural.length > 1 && pageIndex < structural.length) {
    return structural[pageIndex]!;
  }

  const dom = editor.view.dom as HTMLElement;
  const rect = dom.getBoundingClientRect();
  const scale = dom.offsetHeight > 0 ? rect.height / dom.offsetHeight : 1;
  const safeScale = scale > 0.01 ? scale : 1;
  const pageTop = rect.top + pageTopPx * safeScale;
  const pageBottom = rect.top + (pageTopPx + pageHeightPx) * safeScale;
  const blocks: { pos: number; size: number; json: EditorNode }[] = [];

  editor.state.doc.forEach((node, pos) => {
    if (node.type.name === "pageBreak") {
      return;
    }
    const domAt = editor.view.nodeDOM(pos);
    if (!(domAt instanceof HTMLElement)) {
      return;
    }
    const r = domAt.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    if (mid >= pageTop && mid < pageBottom) {
      blocks.push({ pos, size: node.nodeSize, json: node.toJSON() as EditorNode });
    }
  });
  return blocks;
}

function splitByPageBreaks(doc: PMNode): { pos: number; size: number; json: EditorNode }[][] {
  const pages: { pos: number; size: number; json: EditorNode }[][] = [[]];
  doc.forEach((node, pos) => {
    if (node.type.name === "pageBreak") {
      pages.push([]);
      return;
    }
    pages[pages.length - 1]!.push({
      pos,
      size: node.nodeSize,
      json: node.toJSON() as EditorNode,
    });
  });
  return pages;
}
