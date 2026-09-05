import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { isPageBackedDoc } from "./extensions/field-canvas";
import { clamp01 } from "./signer-field-attrs";

type NodeTarget = { pos: number; node: ProseMirrorNode };

export const OVERLAY_TEXT_BOX_PLACEHOLDER = "Insert text here...";

export function isOverlayTextBoxEmpty(node: ProseMirrorNode): boolean {
  if (node.childCount === 0) {
    return true;
  }
  if (node.childCount === 1) {
    const child = node.firstChild;
    if (child?.type.name === "paragraph" && child.content.size === 0) {
      return true;
    }
  }
  return false;
}

export const DEFAULT_OVERLAY_TEXT_BOX_SIZE = { wPct: 0.42, hPct: 0.08 };

export type OverlayTextBoxLayout = {
  boxId: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  page: number;
  zIndex: number;
};

function findNodes(editor: Editor, typeName: string): NodeTarget[] {
  const found: NodeTarget[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === typeName) {
      found.push({ pos, node });
      return false;
    }
    return true;
  });
  return found;
}

function hasCanvas(editor: Editor): boolean {
  return findNodes(editor, "fieldCanvas").length > 0;
}

function ensureOverlay(editor: Editor): NodeTarget | null {
  const existing = findNodes(editor, "fieldOverlay")[0];
  if (existing) {
    return existing;
  }
  if (!editor.schema.nodes.fieldOverlay) {
    return null;
  }
  const inserted = editor
    .chain()
    .insertContentAt(editor.state.doc.content.size, { type: "fieldOverlay" })
    .run();
  if (!inserted) {
    return null;
  }
  return findNodes(editor, "fieldOverlay")[0] ?? null;
}

function findTargetCanvas(editor: Editor): NodeTarget | null {
  const { $from, from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "fieldCanvas") {
      return { pos: $from.before(d), node: $from.node(d) };
    }
  }
  const canvases = findNodes(editor, "fieldCanvas");
  if (canvases.length === 0) {
    return null;
  }
  const preceding = canvases.filter((candidate) => candidate.pos <= from);
  return preceding.at(-1) ?? canvases[0]!;
}

/** Canvas that should host a text box inserted at a top-level slot (gap or after a page). */
export function canvasForInsertPos(editor: Editor, insertPos?: number): NodeTarget | null {
  const canvases = findNodes(editor, "fieldCanvas");
  if (canvases.length === 0) {
    return null;
  }
  if (insertPos == null) {
    return findTargetCanvas(editor);
  }

  for (const canvas of canvases) {
    if (insertPos > canvas.pos && insertPos < canvas.pos + canvas.node.nodeSize) {
      return canvas;
    }
  }
  const atCanvas = canvases.find((canvas) => canvas.pos === insertPos);
  if (atCanvas) {
    return atCanvas;
  }
  const afterCanvas = canvases.find((canvas) => canvas.pos + canvas.node.nodeSize === insertPos);
  if (afterCanvas) {
    return afterCanvas;
  }
  const following = canvases.find((canvas) => canvas.pos >= insertPos);
  return following ?? canvases.at(-1) ?? null;
}

/**
 * True when the insert slot sits in a PDF page seam (between canvases / page
 * breaks). Flow content must not land there — it would shove the next sheet down.
 */
export function isPageBackedSeamInsert(editor: Editor, insertPos: number): boolean {
  if (!isPageBackedDoc(editor.state.doc)) {
    return false;
  }
  const size = editor.state.doc.content.size;
  const clamped = Math.max(0, Math.min(insertPos, size));
  const $pos = editor.state.doc.resolve(clamped);
  if ($pos.depth !== 0) {
    return true;
  }
  const isPageNode = (node: ProseMirrorNode | null | undefined) =>
    node?.type.name === "fieldCanvas" || node?.type.name === "pageBreak";
  return isPageNode($pos.nodeBefore) || isPageNode($pos.nodeAfter);
}

export function isOverlayTextBoxParent(name: string | undefined): boolean {
  return name === "fieldCanvas" || name === "fieldOverlay";
}

export function isOverlayTextBoxNode(node: { type?: { name?: string }; attrs?: Record<string, unknown> } | null): boolean {
  return Boolean(node?.type?.name === "textBox" && String(node.attrs?.boxId ?? ""));
}

export function isOverlayTextBoxEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(".overlay-text-box, [data-text-box-options]"))
  );
}

function overlayTextBoxAtSelection(state: EditorState): { pos: number; node: ProseMirrorNode } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && isOverlayTextBoxNode(selection.node)) {
    return { pos: selection.from, node: selection.node };
  }
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    const node = selection.$from.node(depth);
    if (isOverlayTextBoxNode(node)) {
      return { pos: selection.$from.before(depth), node };
    }
  }
  return null;
}

function selectionIsInsideOverlayBox(selectionFrom: number, boxPos: number, boxSize: number): boolean {
  return selectionFrom > boxPos && selectionFrom < boxPos + boxSize;
}

/** Move the caret out of an overlay text box so its chrome can idle. */
export function collapseOverlayTextBoxSelection(state: EditorState): Transaction | null {
  const box = overlayTextBoxAtSelection(state);
  if (!box) {
    return null;
  }
  const $box = state.doc.resolve(box.pos);
  if ($box.depth > 0) {
    const parentPos = $box.before($box.depth);
    try {
      const next = NodeSelection.create(state.doc, parentPos);
      if (!next.eq(state.selection)) {
        return state.tr.setSelection(next);
      }
    } catch {
      // Parent may not be selectable; fall through to a nearby text cursor.
    }
  }
  const after = Math.min(state.doc.content.size, box.pos + box.node.nodeSize);
  let next = TextSelection.near(state.doc.resolve(after), 1);
  if (selectionIsInsideOverlayBox(next.from, box.pos, box.node.nodeSize)) {
    next = TextSelection.near(state.doc.resolve(box.pos), -1);
  }
  if (selectionIsInsideOverlayBox(next.from, box.pos, box.node.nodeSize) || next.eq(state.selection)) {
    return null;
  }
  return state.tr.setSelection(next);
}

/** Clicks on the page (not the box) should not keep an overlay text box selected. */
export function overlayTextBoxSelectionPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (isOverlayTextBoxEventTarget(event.target)) {
            return false;
          }
          const target = event.target;
          const onPaper =
            target instanceof Element &&
            Boolean(target.closest("[data-creator-paper], .tiptap-creator, .ProseMirror"));
          if (!onPaper) {
            return false;
          }
          if (target instanceof Element && target.closest(".signer-field-node")) {
            return false;
          }
          const tr = collapseOverlayTextBoxSelection(view.state);
          if (!tr) {
            return false;
          }
          view.dispatch(tr);
          return true;
        },
      },
      handleClick(_view, _pos, event) {
        if (isOverlayTextBoxEventTarget(event.target)) {
          return false;
        }
        const target = event.target;
        if (
          !(target instanceof Element) ||
          !target.closest("[data-creator-paper], .tiptap-creator, .ProseMirror")
        ) {
          return false;
        }
        if (target.closest(".signer-field-node")) {
          return false;
        }
        return true;
      },
    },
  });
}

export function overlayParentAt(editor: Editor, pos: number): "fieldCanvas" | "fieldOverlay" | null {
  const $pos = editor.state.doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (name === "fieldCanvas" || name === "fieldOverlay") {
      return name;
    }
  }
  return null;
}

export function newTextBoxId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `textbox-${globalThis.crypto.randomUUID()}`;
  }
  return `textbox-${Date.now().toString(16)}`;
}

export function parseOverlayLayout(raw: Record<string, unknown> | undefined): OverlayTextBoxLayout {
  const size = DEFAULT_OVERLAY_TEXT_BOX_SIZE;
  return {
    boxId: String(raw?.boxId ?? ""),
    xPct: clamp01(Number(raw?.xPct ?? 0.08)),
    yPct: clamp01(Number(raw?.yPct ?? 0.08)),
    wPct: Math.min(1, Math.max(0.04, Number(raw?.wPct ?? size.wPct))),
    hPct: Math.min(1, Math.max(0.03, Number(raw?.hPct ?? size.hPct))),
    page: Math.max(0, Math.trunc(Number(raw?.page ?? 0))),
    zIndex: Math.max(0, Math.trunc(Number(raw?.zIndex ?? 1))),
  };
}

export function nextOverlayTextBoxName(editor: Editor): string {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (isOverlayTextBoxNode(node)) {
      count += 1;
    }
    return true;
  });
  return `Adjustable Text ${count + 1}`;
}

function appendOverlayChild(editor: Editor, target: NodeTarget, json: object): boolean {
  const insertPos = target.pos + 1 + target.node.content.size;
  return editor.chain().focus().insertContentAt(insertPos, json).run();
}

function defaultPlacement(target: NodeTarget): { xPct: number; yPct: number } {
  const overlayCount = target.node.content.childCount;
  let yPct = clamp01(0.06 + overlayCount * 0.08);
  const hPct = DEFAULT_OVERLAY_TEXT_BOX_SIZE.hPct;
  if (yPct + hPct > 1) {
    yPct = Math.max(0.04, 1 - hPct - 0.04);
  }
  return { xPct: 0.08, yPct };
}

function overlayTextBoxJson(
  editor: Editor,
  overrides: Partial<OverlayTextBoxLayout> & { blockName?: string } = {},
): object {
  const size = DEFAULT_OVERLAY_TEXT_BOX_SIZE;
  const layout = parseOverlayLayout({
    boxId: overrides.boxId ?? newTextBoxId(),
    xPct: overrides.xPct ?? 0.08,
    yPct: overrides.yPct ?? 0.08,
    wPct: overrides.wPct ?? size.wPct,
    hPct: overrides.hPct ?? size.hPct,
    page: overrides.page ?? 0,
    zIndex: overrides.zIndex ?? 1,
  });
  return {
    type: "textBox",
    attrs: {
      ...layout,
      blockName: overrides.blockName ?? nextOverlayTextBoxName(editor),
    },
    content: [{ type: "paragraph" }],
  };
}

/**
 * Places a text box on the page overlay (PDF canvas or flowing field overlay)
 * instead of inserting a flow sibling that would push pages apart.
 */
export function insertOverlayTextBox(editor: Editor, insertPos?: number): boolean {
  if (hasCanvas(editor) && editor.schema.nodes.fieldCanvas) {
    const target = canvasForInsertPos(editor, insertPos);
    if (target) {
      const place = defaultPlacement(target);
      return appendOverlayChild(editor, target, overlayTextBoxJson(editor, place));
    }
  }

  if (!editor.schema.nodes.fieldOverlay) {
    return false;
  }
  const overlay = ensureOverlay(editor);
  if (!overlay) {
    return false;
  }
  const place = defaultPlacement(overlay);
  const offset = overlay.node.childCount;
  return appendOverlayChild(
    editor,
    overlay,
    overlayTextBoxJson(editor, {
      ...place,
      page: Math.floor(offset / 8),
    }),
  );
}

export function siblingZIndexes(editor: Editor, pos: number): number[] {
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  const values: number[] = [];
  parent.forEach((child) => {
    if (child.type.name === "textBox" || child.type.name === "signerField") {
      values.push(Math.max(0, Math.trunc(Number(child.attrs.zIndex ?? child.attrs.page ?? 1))));
    }
  });
  return values;
}

export function arrangeOverlayTextBox(editor: Editor, pos: number, edge: "front" | "back"): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!isOverlayTextBoxNode(node)) {
    return false;
  }
  const others = siblingZIndexes(editor, pos);
  const zIndex = edge === "front" ? Math.max(1, ...others, 0) + 1 : Math.max(0, Math.min(...others, 1) - 1);
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      tr.setNodeMarkup(pos, undefined, { ...node!.attrs, zIndex });
      dispatch(tr);
      return true;
    })
    .run();
}

export function duplicateOverlayTextBox(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!isOverlayTextBoxNode(node) || !node) {
    return false;
  }
  const layout = parseOverlayLayout(node.attrs as Record<string, unknown>);
  const json = node.toJSON() as { type: string; attrs?: Record<string, unknown>; content?: unknown };
  return editor
    .chain()
    .insertContentAt(pos + node.nodeSize, {
      ...json,
      attrs: {
        ...(json.attrs ?? {}),
        boxId: newTextBoxId(),
        xPct: clamp01(layout.xPct + 0.02),
        yPct: clamp01(layout.yPct + 0.02),
        zIndex: layout.zIndex + 1,
      },
    } as JSONContent)
    .run();
}
