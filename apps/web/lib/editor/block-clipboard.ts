import type { EditorNode } from "./types";

let clipboard: EditorNode | null = null;

export function setBlockClipboard(node: EditorNode): void {
  clipboard = node;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(JSON.stringify(node)).catch(() => undefined);
  }
}

export function getBlockClipboard(): EditorNode | null {
  return clipboard;
}

export function hasBlockClipboard(): boolean {
  return clipboard !== null;
}
