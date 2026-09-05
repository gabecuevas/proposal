import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  CREATOR_PAPER_SELECTOR,
  pageAtVisualOffset,
  readPaperPageGapPx,
  readPaperPageHeightPx,
  visualTopForPage,
} from "./page-geometry";
import {
  attrsToJson,
  clamp01,
  defaultSignerFieldAttrs,
  defaultPlaceholderForType,
  defaultSizeForType,
  parseSignerFieldAttrs,
  type SignerFieldEditorType,
} from "./signer-field-attrs";

type NodeTarget = { pos: number; node: ProseMirrorNode };

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

/**
 * Inserts a signer field into an overlay/canvas in one transaction.
 * Creating the overlay empty then appending the field in a second step can
 * leave a barren overlay when a React node view is still mounting.
 */
function insertFieldIntoContainer(
  editor: Editor,
  target: NodeTarget | null,
  attrs: Record<string, unknown>,
): boolean {
  const fieldType = editor.schema.nodes.signerField;
  const overlayType = editor.schema.nodes.fieldOverlay;
  if (!fieldType) {
    return false;
  }

  const fieldNode = fieldType.create(attrs);
  let tr = editor.state.tr;

  if (target) {
    const insertPos = target.pos + 1 + target.node.content.size;
    tr = tr.insert(insertPos, fieldNode);
  } else {
    if (!overlayType) {
      return false;
    }
    const overlayNode = overlayType.create(null, fieldNode);
    tr = tr.insert(editor.state.doc.content.size, overlayNode);
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
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
        ...defaultSizeForType(input.type),
        placeholder: defaultPlaceholderForType(input.type),
        label: defaultLabelForType(input.type),
        ...overrides,
      } as Record<string, unknown>,
      index,
    ),
  );
}

/** Prefer the caret / viewport so click-insert lands on the text the user is looking at. */
function placementNearSelection(
  editor: Editor,
  size: { wPct: number; hPct: number },
): { xPct: number; yPct: number; page: number } | null {
  if (typeof document === "undefined") {
    return null;
  }
  const paper = document.querySelector(CREATOR_PAPER_SELECTOR) as HTMLElement | null;
  if (!paper) {
    return null;
  }
  const paperRect = paper.getBoundingClientRect();
  if (paperRect.width <= 0 || paperRect.height <= 0) {
    return null;
  }

  let clientX = paperRect.left + paperRect.width * 0.12;
  let clientY = paperRect.top + Math.min(paperRect.height, window.innerHeight - paperRect.top) * 0.28;
  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    if (Number.isFinite(coords.left) && Number.isFinite(coords.top)) {
      clientX = coords.left;
      clientY = coords.top;
    }
  } catch {
    // keep viewport fallback
  }

  const pageHeightPx = readPaperPageHeightPx(paper);
  const gapPx = readPaperPageGapPx(paper);
  const xPct = centered(clientX - paperRect.left, paperRect.width, size.wPct);
  const yFromTop = Math.max(0, clientY - paperRect.top);
  const page = pageAtVisualOffset(yFromTop, pageHeightPx, gapPx);
  const yPct = Math.min(
    Math.max(0, 1 - size.hPct),
    (yFromTop - visualTopForPage(page, pageHeightPx, gapPx)) / pageHeightPx - size.hPct / 2,
  );
  return { xPct, yPct, page };
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
  const size = defaultSizeForType(input.type);
  const near =
    input.xPct === undefined || input.yPct === undefined || input.page === undefined
      ? placementNearSelection(editor, size)
      : null;
  const overrides: Record<string, unknown> = {
    ...(typeof input.xPct === "number" ? { xPct: clamp01(input.xPct) } : near ? { xPct: near.xPct } : {}),
    ...(typeof input.yPct === "number" ? { yPct: clamp01(input.yPct) } : near ? { yPct: near.yPct } : {}),
    ...(typeof input.page === "number"
      ? { page: Math.max(0, Math.trunc(input.page)) }
      : near
        ? { page: near.page }
        : {}),
  };

  if (hasCanvas(editor)) {
    const target = findTargetCanvas(editor);
    if (target) {
      const offset = target.node.childCount;
      if (overrides.yPct === undefined) {
        let yPct = clamp01(0.04 + offset * 0.1);
        if (yPct + size.hPct > 1) {
          yPct = Math.max(0.02, 1 - size.hPct - 0.02);
        }
        overrides.yPct = yPct;
      }
      return insertFieldIntoContainer(editor, target, newFieldAttrs(input, overrides, offset));
    }
  }

  const overlay = findNodes(editor, "fieldOverlay")[0] ?? null;
  const offset = overlay?.node.childCount ?? 0;
  if (overrides.yPct === undefined) {
    overrides.yPct = clamp01(0.06 + (offset % 8) * 0.1);
  }
  if (overrides.page === undefined) {
    overrides.page = Math.floor(offset / 8);
  }
  return insertFieldIntoContainer(editor, overlay, newFieldAttrs(input, overrides, offset));
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
  const size = defaultSizeForType(input.type);
  const hit = document.elementFromPoint(input.clientX, input.clientY);
  const canvasEl = hit?.closest("[data-field-canvas]") as HTMLElement | null;

  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const target = canvasFromElement(editor, canvasEl);
      const xPct = centered(input.clientX - rect.left, rect.width, size.wPct);
      const yPct = centered(input.clientY - rect.top, rect.height, size.hPct);
      if (target) {
        return insertFieldIntoContainer(
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
  const gapPx = readPaperPageGapPx(paper);
  const xPct = centered(input.clientX - paperRect.left, paperRect.width, size.wPct);
  const yFromTop = Math.max(0, input.clientY - paperRect.top);
  const page = pageAtVisualOffset(yFromTop, pageHeightPx, gapPx);
  const yPct = Math.min(
    Math.max(0, 1 - size.hPct),
    (yFromTop - visualTopForPage(page, pageHeightPx, gapPx)) / pageHeightPx - size.hPct / 2,
  );

  const overlay = findNodes(editor, "fieldOverlay")[0] ?? null;
  return insertFieldIntoContainer(
    editor,
    overlay,
    newFieldAttrs(input, { xPct, yPct, page }, overlay?.node.childCount ?? 0),
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
      return "";
    case "checkbox":
      return "Checkbox";
    case "dropdown":
      return "Select";
    default:
      return "Field";
  }
}

export function pasteCopiedSignerField(
  editor: Editor,
  copied: { type: "signerField"; attrs: Record<string, unknown> },
): boolean {
  const attrs = parseSignerFieldAttrs(
    {
      ...copied.attrs,
      fieldId: `field-${globalThis.crypto.randomUUID()}`,
      xPct: clamp01(Number(copied.attrs.xPct ?? 0.04) + 0.03),
      yPct: clamp01(Number(copied.attrs.yPct ?? 0.04) + 0.03),
    },
    0,
  );
  const json = attrsToJson(attrs);
  if (hasCanvas(editor)) {
    const target = findTargetCanvas(editor);
    if (target) {
      return insertFieldIntoContainer(editor, target, json);
    }
  }
  const overlay = findNodes(editor, "fieldOverlay")[0] ?? null;
  return insertFieldIntoContainer(editor, overlay, json);
}
