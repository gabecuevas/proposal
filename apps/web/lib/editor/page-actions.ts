import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { requestPageFlowSync } from "./extensions/page-flow";
import {
  defaultLibraryNameFromNodes,
  sliceNodesToDoc,
} from "./library-blocks";
import {
  deletePageBackgrounds,
  duplicatePageBackgrounds,
  parsePageBackgrounds,
} from "./page-backgrounds";
import {
  pageAtVisualOffset,
  pageCountForPaperHeight,
  readPaperPageGapPx,
  readPaperPageHeightPx,
} from "./page-geometry";
import type { EditorDoc, EditorNode } from "./types";

export type PageBlock = {
  pos: number;
  size: number;
  type: string;
  json: EditorNode;
};

type OverlayFieldMode = "duplicate" | "delete";

function newCloneId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** Clone a page element, giving signer fields new ids so values do not collide. */
export function clonePageNodeJson(node: EditorNode): EditorNode {
  const clone = structuredClone(node);
  remapCloneIds(clone);
  return clone;
}

function remapCloneIds(node: EditorNode): void {
  if (node.type === "signerField") {
    node.attrs = {
      ...(node.attrs ?? {}),
      fieldId: `field-${newCloneId()}`,
    };
  }
  for (const child of node.content ?? []) {
    remapCloneIds(child);
  }
}

export function canDeletePage(pageCount: number): boolean {
  return pageCount > 1;
}

export function splitTopLevelByPageBreaks(doc: PMNode): PageBlock[][] {
  const pages: PageBlock[][] = [[]];
  doc.forEach((node, pos) => {
    if (node.type.name === "fieldOverlay") {
      return;
    }
    if (node.type.name === "pageBreak") {
      pages.push([]);
      return;
    }
    pages[pages.length - 1]!.push({
      pos,
      size: node.nodeSize,
      type: node.type.name,
      json: node.toJSON() as EditorNode,
    });
  });
  return pages;
}

function overlayPos(doc: PMNode): number {
  let found = doc.content.size;
  doc.forEach((node, pos) => {
    if (node.type.name === "fieldOverlay") {
      found = pos;
    }
  });
  return found;
}

function findOverlay(doc: PMNode): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  doc.forEach((node, pos) => {
    if (node.type.name === "fieldOverlay") {
      found = { pos, node };
    }
  });
  return found;
}

function nodeBefore(doc: PMNode, pos: number): { node: PMNode; pos: number } | null {
  if (pos <= 0) {
    return null;
  }
  let previous: { node: PMNode; pos: number } | null = null;
  doc.forEach((node, offset) => {
    if (offset < pos) {
      previous = { node, pos: offset };
    }
  });
  return previous;
}

function hasContentBetween(doc: PMNode, from: number, to: number): boolean {
  let found = false;
  doc.forEach((node, pos) => {
    if (
      pos >= from &&
      pos < to &&
      node.type.name !== "fieldOverlay" &&
      node.type.name !== "pageBreak"
    ) {
      found = true;
    }
  });
  return found;
}

function visualLayoutUsable(blocks: { top: number; bottom: number }[]): boolean {
  return blocks.some((block) => block.bottom > block.top);
}

function measureVisualBlocks(editor: Editor, paper: HTMLElement): Array<PageBlock & { top: number; bottom: number }> {
  const paperTop = paper.getBoundingClientRect().top;
  const blocks: Array<PageBlock & { top: number; bottom: number }> = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === "fieldOverlay") {
      return;
    }
    const dom = editor.view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) {
      return;
    }
    const rect = dom.getBoundingClientRect();
    blocks.push({
      pos: offset,
      size: node.nodeSize,
      type: node.type.name,
      json: node.toJSON() as EditorNode,
      top: rect.top - paperTop,
      bottom: rect.bottom - paperTop,
    });
  });
  return blocks;
}

export function collectPageBlocks(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
): PageBlock[] {
  const i = Math.max(0, Math.trunc(pageIndex));
  if (paper) {
    const visual = measureVisualBlocks(editor, paper);
    if (visualLayoutUsable(visual)) {
      const height = readPaperPageHeightPx(paper);
      const gap = readPaperPageGapPx(paper);
      return visual.filter(
        (block) =>
          block.type !== "pageBreak" &&
          pageAtVisualOffset(block.top + 1, height, gap) === i,
      );
    }
  }
  return splitTopLevelByPageBreaks(editor.state.doc)[i] ?? [];
}

function insertPosAfterPage(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
): number {
  const doc = editor.state.doc;
  const overlay = overlayPos(doc);
  const i = Math.max(0, Math.trunc(pageIndex));
  const blocks = collectPageBlocks(editor, paper, i);

  if (blocks.length) {
    const last = blocks[blocks.length - 1]!;
    let pos = last.pos + last.size;
    const next = doc.nodeAt(pos);
    if (next?.type.name === "pageBreak") {
      pos += next.nodeSize;
    }
    return Math.min(pos, overlay);
  }

  let afterOpening = i === 0 ? 0 : overlay;
  let afterClosing: number | null = null;
  let breaks = 0;
  doc.forEach((node, pos) => {
    if (node.type.name !== "pageBreak") {
      return;
    }
    breaks += 1;
    if (breaks === i) {
      afterOpening = pos + node.nodeSize;
    }
    if (breaks === i + 1) {
      afterClosing = pos + node.nodeSize;
    }
  });
  return Math.min(afterClosing ?? afterOpening, overlay);
}

function fieldPage(node: EditorNode): number {
  const raw = node.attrs?.page;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function remapOverlayFields(overlayJson: EditorNode, pageIndex: number, mode: OverlayFieldMode): EditorNode {
  const fields = overlayJson.content ?? [];
  const next: EditorNode[] = [];
  const clones: EditorNode[] = [];
  for (const field of fields) {
    const page = fieldPage(field);
    if (mode === "delete") {
      if (page === pageIndex) {
        continue;
      }
      if (page > pageIndex) {
        next.push({
          ...field,
          attrs: { ...(field.attrs ?? {}), page: page - 1 },
        });
      } else {
        next.push(field);
      }
      continue;
    }
    if (page === pageIndex) {
      next.push(field);
      const cloned = clonePageNodeJson(field);
      cloned.attrs = { ...(cloned.attrs ?? {}), page: pageIndex + 1 };
      clones.push(cloned);
    } else if (page > pageIndex) {
      next.push({
        ...field,
        attrs: { ...(field.attrs ?? {}), page: page + 1 },
      });
    } else {
      next.push(field);
    }
  }
  if (mode === "duplicate") {
    next.push(...clones);
  }
  return { ...overlayJson, content: next };
}

function replaceOverlay(tr: { doc: PMNode; replaceWith: (from: number, to: number, node: PMNode) => unknown }, schema: PMNode["type"]["schema"], overlay: { pos: number; node: PMNode }, nextJson: EditorNode) {
  const nextNode = schema.nodeFromJSON(nextJson);
  tr.replaceWith(overlay.pos, overlay.pos + overlay.node.nodeSize, nextNode);
}

function dropPageBreaksAfterOverlay(tr: { doc: PMNode; delete: (from: number, to: number) => unknown }) {
  const ranges: { from: number; to: number }[] = [];
  const overlay = overlayPos(tr.doc);
  tr.doc.forEach((node, pos) => {
    if (node.type.name === "pageBreak" && pos > overlay) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  for (const range of ranges.sort((a, b) => b.from - a.from)) {
    tr.delete(range.from, range.to);
  }
}

function contentBlockCount(doc: PMNode): number {
  let count = 0;
  doc.forEach((node) => {
    if (node.type.name !== "fieldOverlay") {
      count += 1;
    }
  });
  return count;
}

function deleteRangesForPage(editor: Editor, paper: HTMLElement | null | undefined, pageIndex: number): { from: number; to: number }[] {
  const doc = editor.state.doc;
  const blocks = collectPageBlocks(editor, paper, pageIndex);
  const ranges: { from: number; to: number }[] = blocks.map((block) => ({
    from: block.pos,
    to: block.pos + block.size,
  }));

  if (blocks.length) {
    const last = blocks[blocks.length - 1]!;
    const after = last.pos + last.size;
    const next = doc.nodeAt(after);
    if (next?.type.name === "pageBreak") {
      ranges.push({ from: after, to: after + next.nodeSize });
    } else {
      const first = blocks[0]!;
      const previous = nodeBefore(doc, first.pos);
      if (previous?.node.type.name === "pageBreak") {
        ranges.push({ from: previous.pos, to: previous.pos + previous.node.nodeSize });
      }
    }
    return ranges;
  }

  const structural = splitTopLevelByPageBreaks(doc);
  if (pageIndex >= structural.length || (structural[pageIndex]?.length ?? 0) > 0) {
    return ranges;
  }

  const breaks: { from: number; to: number }[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name === "pageBreak") {
      breaks.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  const target = breaks[Math.max(0, pageIndex - 1)];
  if (target) {
    ranges.push(target);
  }
  return ranges;
}

export function duplicateVisualPage(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
): boolean {
  const i = Math.max(0, Math.trunc(pageIndex));
  const ok = editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      const { doc, schema } = state;
      const overlay = overlayPos(doc);
      const insertAt = insertPosAfterPage(editor, paper, i);
      const blocks = collectPageBlocks(editor, paper, i);
      const cloned = blocks.map((block) => clonePageNodeJson(block.json));
      const pageBreakType = schema.nodes.pageBreak;
      const paragraphType = schema.nodes.paragraph;
      if (!pageBreakType || !paragraphType) {
        return false;
      }

      const before = nodeBefore(doc, insertAt);
      const isBreakBefore = before?.node.type.name === "pageBreak";
      const followingIsContent = hasContentBetween(doc, insertAt, overlay);
      const insertJson: EditorNode[] = [];
      if (!isBreakBefore || (!followingIsContent && cloned.length === 0)) {
        insertJson.push({ type: "pageBreak" });
      }
      if (cloned.length) {
        insertJson.push(...cloned);
      } else {
        insertJson.push({ type: "paragraph" });
      }
      if (followingIsContent) {
        insertJson.push({ type: "pageBreak" });
      }

      const nodes = insertJson.map((node) => schema.nodeFromJSON(node));
      tr.insert(insertAt, Fragment.fromArray(nodes));

      const mappedOverlay = findOverlay(tr.doc);
      if (mappedOverlay) {
        const nextJson = remapOverlayFields(mappedOverlay.node.toJSON() as EditorNode, i, "duplicate");
        replaceOverlay(tr, schema, mappedOverlay, nextJson);
      }

      tr.setDocAttribute(
        "pageBackgrounds",
        duplicatePageBackgrounds(parsePageBackgrounds(doc.attrs.pageBackgrounds), i),
      );
      dropPageBreaksAfterOverlay(tr);
      dispatch(tr);
      return true;
    })
    .run();
  if (ok) {
    requestPageFlowSync(editor);
  }
  return ok;
}

export function deleteVisualPage(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
  pageCount: number,
): boolean {
  if (!canDeletePage(pageCount)) {
    return false;
  }
  const i = Math.max(0, Math.trunc(pageIndex));
  const ok = editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      const { doc, schema } = state;
      const ranges = deleteRangesForPage(editor, paper, i).sort((a, b) => b.from - a.from);
      for (const range of ranges) {
        const mappedFrom = tr.mapping.map(range.from);
        const mappedTo = tr.mapping.map(range.to);
        if (mappedTo > mappedFrom) {
          tr.delete(mappedFrom, mappedTo);
        }
      }

      if (contentBlockCount(tr.doc) === 0) {
        const paragraph = schema.nodes.paragraph;
        if (paragraph) {
          tr.insert(0, paragraph.create());
        }
      }

      const overlay = findOverlay(tr.doc);
      if (overlay) {
        const nextJson = remapOverlayFields(overlay.node.toJSON() as EditorNode, i, "delete");
        replaceOverlay(tr, schema, overlay, nextJson);
      }

      tr.setDocAttribute(
        "pageBackgrounds",
        deletePageBackgrounds(parsePageBackgrounds(doc.attrs.pageBackgrounds), i),
      );
      dropPageBreaksAfterOverlay(tr);
      dispatch(tr);
      return true;
    })
    .run();
  if (ok) {
    requestPageFlowSync(editor);
  }
  return ok;
}

export function pageLibraryPayload(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
): { name: string; block_type: string; editor_json: EditorDoc } {
  const i = Math.max(0, Math.trunc(pageIndex));
  const nodes = collectPageBlocks(editor, paper, i)
    .filter((block) => block.type !== "pageBreak")
    .map((block) => block.json);
  const fallback = `Page ${i + 1}`;
  return {
    name: defaultLibraryNameFromNodes(nodes, fallback),
    block_type: "text",
    editor_json: sliceNodesToDoc(nodes),
  };
}

export async function savePageToLibrary(
  editor: Editor,
  paper: HTMLElement | null | undefined,
  pageIndex: number,
): Promise<{ ok: boolean; message: string }> {
  const payload = pageLibraryPayload(editor, paper, pageIndex);
  try {
    const response = await fetch("/api/content-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Could not save to the content library");
    }
    return { ok: true, message: "Saved to content library" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save",
    };
  }
}

/** Live visual page count when paper is painted; otherwise page-break structure. */
export function resolvedPageCount(editor: Editor, paper: HTMLElement | null | undefined): number {
  const structural = Math.max(1, splitTopLevelByPageBreaks(editor.state.doc).length);
  if (!paper || paper.scrollHeight <= 0) {
    return structural;
  }
  return Math.max(
    structural,
    pageCountForPaperHeight(paper.scrollHeight, readPaperPageHeightPx(paper), readPaperPageGapPx(paper)),
  );
}
