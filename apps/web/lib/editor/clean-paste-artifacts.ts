import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { clampPasteLineHeight, isPastePageFooterText } from "./paste";

const MAX_LINE_HEIGHT = 2;

function clampLineHeightAttr(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const clamped = clampPasteLineHeight(value);
  if (!clamped || clamped === value) {
    return null;
  }
  return clamped;
}

/**
 * Removes pasted "Page N of N" / copyright footers and clamps extreme
 * line-heights inside a block so page gaps stop slicing signature lines.
 */
export function cleanPasteArtifactsAt(editor: Editor, pos: number): { removedFooters: number; clampedHeights: number } {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return { removedFooters: 0, clampedHeights: 0 };
  }

  let removedFooters = 0;
  let clampedHeights = 0;
  const footerPositions: number[] = [];
  const heightUpdates: { pos: number; node: PMNode; lineHeight: string }[] = [];

  node.descendants((child, relativePos) => {
    const absolute = pos + 1 + relativePos;
    if (child.isTextblock && isPastePageFooterText(child.textContent)) {
      footerPositions.push(absolute);
      return false;
    }
    if (child.isTextblock && typeof child.attrs.lineHeight === "string") {
      const next = clampLineHeightAttr(child.attrs.lineHeight);
      if (next && next !== child.attrs.lineHeight) {
        heightUpdates.push({ pos: absolute, node: child, lineHeight: next });
      }
    }
    return true;
  });

  if (footerPositions.length === 0 && heightUpdates.length === 0) {
    return { removedFooters: 0, clampedHeights: 0 };
  }

  let tr = editor.state.tr;
  // Delete from the end so earlier positions stay valid.
  for (const footerPos of [...footerPositions].sort((a, b) => b - a)) {
    const target = tr.doc.nodeAt(footerPos);
    if (!target) {
      continue;
    }
    tr = tr.delete(footerPos, footerPos + target.nodeSize);
    removedFooters += 1;
  }

  for (const update of heightUpdates) {
    const mapped = tr.mapping.map(update.pos);
    const target = tr.doc.nodeAt(mapped);
    if (!target?.isTextblock) {
      continue;
    }
    tr = tr.setNodeMarkup(mapped, undefined, { ...target.attrs, lineHeight: update.lineHeight });
    clampedHeights += 1;
  }

  if (removedFooters > 0 || clampedHeights > 0) {
    editor.view.dispatch(tr.scrollIntoView());
    if (typeof editor.commands.refreshPageFlow === "function") {
      editor.commands.refreshPageFlow();
    }
  }

  return { removedFooters, clampedHeights };
}

export function pasteArtifactsPresentIn(node: PMNode): boolean {
  let found = false;
  node.descendants((child) => {
    if (found) {
      return false;
    }
    if (child.isTextblock && isPastePageFooterText(child.textContent)) {
      found = true;
      return false;
    }
    if (child.isTextblock && typeof child.attrs.lineHeight === "string") {
      const n = Number(child.attrs.lineHeight);
      if (Number.isFinite(n) && n > MAX_LINE_HEIGHT) {
        found = true;
        return false;
      }
    }
    return true;
  });
  return found;
}
