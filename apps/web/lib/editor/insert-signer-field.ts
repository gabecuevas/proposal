import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { CREATOR_PAPER_SELECTOR, readPaperPageHeightPx } from "./page-geometry";
import {
  attrsToJson,
  clamp01,
  defaultSignerFieldAttrs,
  parseSignerFieldAttrs,
  type SignerFieldEditorType,
} from "./signer-field-attrs";

type NodeTarget = { pos: number; node: ProseMirrorNode };

export { CREATOR_PAPER_SELECTOR };

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

/**
 * Documents built from a PDF upload position fields inside the page canvas they
 * were dropped on; documents written from scratch use a single overlay layer
 * stacked on top of the flowing content.
 */
function hasCanvas(editor: Editor): boolean {
  return findNodes(editor, "fieldCanvas").length > 0;
}

/** Returns the overlay node, appending one to the end of the doc if needed. */
function ensureOverlay(editor: Editor): NodeTarget | null {
  const existing = findNodes(editor, "fieldOverlay")[0];
  if (existing) {
    return existing;
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

function appendField(
  editor: Editor,
  target: NodeTarget,
  attrs: Record<string, unknown>,
): boolean {
  const insertPos = target.pos + 1 + target.node.content.size;
  return editor.chain().focus().insertContentAt(insertPos, { type: "signerField", attrs }).run();
}

function newFieldAttrs(
  input: { recipientId: string; type: SignerFieldEditorType },
  overrides: Partial<Record<string, unknown>>,
  index: number,
) {
  return attrsToJson(
    parseSignerFieldAttrs(
      {
        fieldId: `field-${globalThis.crypto.randomUUID()}`,
        recipientId: input.recipientId,
        type: input.type,
        ...defaultSignerFieldAttrs(),
        label: defaultLabelForType(input.type),
        ...overrides,
      } as Record<string, unknown>,
      index,
    ),
  );
}

export function insertSignerFieldBlock(
  editor: Editor,
  input: {
    recipientId: string;
    type: SignerFieldEditorType;
    /** Drop location as a fraction of the target canvas or page. */
    xPct?: number;
    yPct?: number;
    page?: number;
  },
): boolean {
  const defaults = defaultSignerFieldAttrs();
  const overrides: Record<string, unknown> = {
    ...(typeof input.xPct === "number" ? { xPct: clamp01(input.xPct) } : {}),
    ...(typeof input.yPct === "number" ? { yPct: clamp01(input.yPct) } : {}),
    ...(typeof input.page === "number" ? { page: Math.max(0, Math.trunc(input.page)) } : {}),
  };

  if (hasCanvas(editor)) {
    const target = findTargetCanvas(editor);
    if (target) {
      const offset = target.node.childCount;
      if (overrides.yPct === undefined) {
        let yPct = clamp01(0.04 + offset * 0.1);
        if (yPct + defaults.hPct > 1) {
          yPct = Math.max(0.02, 1 - defaults.hPct - 0.02);
        }
        overrides.yPct = yPct;
      }
      return appendField(editor, target, newFieldAttrs(input, overrides, offset));
    }
  }

  const overlay = ensureOverlay(editor);
  if (!overlay) {
    return false;
  }
  const offset = overlay.node.childCount;
  if (overrides.yPct === undefined) {
    overrides.yPct = clamp01(0.06 + (offset % 8) * 0.1);
  }
  if (overrides.page === undefined) {
    overrides.page = Math.floor(offset / 8);
  }
  return appendField(editor, overlay, newFieldAttrs(input, overrides, offset));
}

/**
 * Places a field where it was released. A drop over an uploaded page lands on
 * that page's canvas; anywhere else lands on the overlay above the content, so
 * a signature can sit on top of text, an image, a table or a video.
 */
export function insertSignerFieldAtPoint(
  editor: Editor,
  input: {
    recipientId: string;
    type: SignerFieldEditorType;
    clientX: number;
    clientY: number;
  },
): boolean {
  const defaults = defaultSignerFieldAttrs();
  const hit = document.elementFromPoint(input.clientX, input.clientY);
  const canvasEl = hit?.closest("[data-field-canvas]") as HTMLElement | null;

  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const target = canvasFromElement(editor, canvasEl);
      const xPct = centered(input.clientX - rect.left, rect.width, defaults.wPct);
      const yPct = centered(input.clientY - rect.top, rect.height, defaults.hPct);
      if (target) {
        return appendField(
          editor,
          target,
          newFieldAttrs(input, { xPct, yPct, page: 0 }, target.node.childCount),
        );
      }
      return insertSignerFieldBlock(editor, { ...input, xPct, yPct });
    }
  }

  const paper = (hit?.closest(CREATOR_PAPER_SELECTOR) ??
    document.querySelector(CREATOR_PAPER_SELECTOR)) as HTMLElement | null;
  if (!paper) {
    return insertSignerFieldBlock(editor, input);
  }

  const paperRect = paper.getBoundingClientRect();
  if (paperRect.width <= 0) {
    return insertSignerFieldBlock(editor, input);
  }

  const pageHeightPx = readPaperPageHeightPx(paper);
  const xPct = centered(input.clientX - paperRect.left, paperRect.width, defaults.wPct);
  const absoluteY = Math.max(
    0,
    (input.clientY - paperRect.top) / pageHeightPx - defaults.hPct / 2,
  );
  const page = Math.floor(absoluteY);
  const yPct = Math.min(Math.max(0, 1 - defaults.hPct), absoluteY - page);

  const overlay = ensureOverlay(editor);
  if (!overlay) {
    return false;
  }
  return appendField(
    editor,
    overlay,
    newFieldAttrs(input, { xPct, yPct, page }, overlay.node.childCount),
  );
}

function centered(offsetPx: number, extentPx: number, sizePct: number): number {
  return Math.min(Math.max(0, 1 - sizePct), clamp01(offsetPx / extentPx - sizePct / 2));
}

function canvasFromElement(editor: Editor, canvasEl: HTMLElement): NodeTarget | null {
  const canvases = findNodes(editor, "fieldCanvas");
  const index = Array.from(document.querySelectorAll(".ProseMirror [data-field-canvas]")).indexOf(
    canvasEl,
  );
  return canvases[index] ?? null;
}

/**
 * Prefers the canvas the cursor sits in, then the last one at or above the
 * cursor. An uploaded document is already a canvas per page, so adding a field
 * should land on a page rather than append an empty canvas after it.
 */
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

function defaultLabelForType(type: SignerFieldEditorType): string {
  switch (type) {
    case "signature":
      return "Signature";
    case "initial":
      return "Initials";
    case "date":
      return "Date";
    case "text":
      return "Text";
    case "checkbox":
      return "Checkbox";
    case "dropdown":
      return "Select";
    default:
      return "Field";
  }
}
