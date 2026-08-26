import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { contentOffsetFromVisual, flowBreakPositions, type FlowLine } from "../page-flow";
import {
  pageSeamMetricsFromStyles,
  printableContentHeight,
  seamSpacerHeight,
  spacerHeightAbove,
  validFlowPos,
} from "../page-seam";

const key = new PluginKey<DecorationSet>("pageFlow");
const pendingRefresh = new WeakSet<EditorView>();
const SKIP_SELECTOR =
  ".creator-flow-break, .field-overlay, [data-field-overlay], .signer-field-node, .ProseMirror-widget";
const OVERLAY_HIT_SELECTOR = ".field-overlay, [data-field-overlay], .signer-field-node";
const TABLE_SKIP_SELECTOR = "table, [data-node-type='quoteTable'], .quote-table";
const KEEP_TOGETHER_SELECTOR =
  "img, hr, [data-node-type='pageBreak'], [data-page-break], [data-youtube-video], .creator-image-block, [data-node-type='quoteTable'], .quote-table";
const MAX_LAYOUT_PASSES = 12;
const CONNECT_RETRY_FRAMES = 30;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageFlow: {
      refreshPageFlow: () => ReturnType;
    };
  }
}

type VisualLine = { top: number; bottom: number; left: number; node: Node; offset: number };

function isSkipped(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return Boolean(el?.closest(SKIP_SELECTOR));
}

function insideTableLike(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return Boolean(el?.closest(TABLE_SKIP_SELECTOR));
}

/** Overlay nodes steal caret hit-testing even with pointer-events: none. */
export function pauseOverlayHitTesting<T>(root: ParentNode, run: () => T): T {
  const overlays = [...root.querySelectorAll(OVERLAY_HIT_SELECTOR)] as HTMLElement[];
  const previous = overlays.map((el) => el.style.visibility);
  for (const el of overlays) {
    el.style.visibility = "hidden";
  }
  try {
    return run();
  } finally {
    overlays.forEach((el, index) => {
      el.style.visibility = previous[index] ?? "";
    });
  }
}

function lineStartsInTextNode(textNode: Text, rootTop: number): VisualLine[] {
  const text = textNode.nodeValue ?? "";
  const lines: VisualLine[] = [];
  const range = document.createRange();
  let lineTop = Number.NaN;
  for (let i = 0; i < text.length; i += 1) {
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    const rect = range.getBoundingClientRect();
    if (rect.height < 1 || rect.width < 1) {
      continue;
    }
    if (!Number.isFinite(lineTop) || Math.abs(rect.top - lineTop) > 1.5) {
      lineTop = rect.top;
      lines.push({
        top: rect.top - rootTop,
        bottom: rect.bottom - rootTop,
        left: rect.left,
        node: textNode,
        offset: i,
      });
    }
  }
  return lines;
}

function collectLines(view: EditorView): VisualLine[] {
  const root = view.dom;
  const rootRect = root.getBoundingClientRect();
  const boxes: VisualLine[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (isSkipped(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (node instanceof Text) {
        if (insideTableLike(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
      if (node instanceof Element) {
        if (node.matches("[data-creator-flow-break]")) {
          return NodeFilter.FILTER_REJECT;
        }
        const keepTogetherParent = node.closest(KEEP_TOGETHER_SELECTOR);
        if (keepTogetherParent && keepTogetherParent !== node) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.matches(KEEP_TOGETHER_SELECTOR)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.matches("tr")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.matches("table")) {
          return NodeFilter.FILTER_SKIP;
        }
        if (node.matches("p, h1, h2, h3, li") && !node.textContent) {
          return NodeFilter.FILTER_ACCEPT;
        }
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) {
      boxes.push(...lineStartsInTextNode(node, rootRect.top));
    } else if (node instanceof Element) {
      const rect = node.getBoundingClientRect();
      if (rect.height < 1) {
        continue;
      }
      boxes.push({
        top: rect.top - rootRect.top,
        bottom: rect.bottom - rootRect.top,
        left: rect.left,
        node,
        offset: 0,
      });
    }
  }

  boxes.sort((a, b) => a.top - b.top || a.left - b.left);
  return boxes;
}

function safePosAtDOM(view: EditorView, node: Node, offset: number): number | null {
  try {
    return validFlowPos(view.state.doc.content.size, view.posAtDOM(node, offset));
  } catch {
    return null;
  }
}

function insideFieldOverlay(view: EditorView, pos: number): boolean {
  try {
    const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === "fieldOverlay") {
        return true;
      }
    }
  } catch {
    return true;
  }
  return false;
}

function posFromCaret(view: EditorView, clientX: number, clientY: number): number | null {
  const doc = view.dom.ownerDocument;
  const caret = (
    doc as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint?.(clientX, clientY);
  if (caret?.offsetNode && view.dom.contains(caret.offsetNode)) {
    const pos = safePosAtDOM(view, caret.offsetNode, caret.offset);
    if (pos != null) {
      return pos;
    }
  }
  const range = doc.caretRangeFromPoint?.(clientX, clientY);
  if (range?.startContainer && view.dom.contains(range.startContainer)) {
    const pos = safePosAtDOM(view, range.startContainer, range.startOffset);
    if (pos != null) {
      return pos;
    }
  }
  return validFlowPos(view.state.doc.content.size, view.posAtCoords({ left: clientX, top: clientY })?.pos ?? null);
}

function posForLine(view: EditorView, line: VisualLine): number | null {
  const fromNode = safePosAtDOM(view, line.node, line.offset);
  if (fromNode != null && !insideFieldOverlay(view, fromNode)) {
    return fromNode;
  }
  const rootRect = view.dom.getBoundingClientRect();
  const clientX = line.left + 2;
  const clientY = rootRect.top + line.top + Math.min(4, (line.bottom - line.top) / 2);
  const pos = posFromCaret(view, clientX, clientY);
  if (pos == null || insideFieldOverlay(view, pos)) {
    return null;
  }
  return pos;
}

function forcedBreakPositions(view: EditorView): number[] {
  const positions: number[] = [];
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === "pageBreak") {
      positions.push(pos + node.nodeSize);
    }
  });
  return positions;
}

export function createFlowBreakElement(heightPx: number): HTMLElement {
  const el = document.createElement("span");
  el.className = "creator-flow-break";
  el.setAttribute("data-creator-flow-break", "true");
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  const height = `${Math.max(1, Math.round(heightPx))}px`;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = height;
  el.style.minHeight = height;
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.lineHeight = "0";
  el.style.fontSize = "0";
  el.style.overflow = "hidden";
  el.style.clear = "both";
  el.style.pointerEvents = "none";
  el.style.position = "static";
  el.style.left = "0";
  el.style.transform = "none";
  el.style.background = "transparent";
  el.style.boxShadow = "none";
  el.style.breakBefore = "auto";
  return el;
}

function samePositions(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((pos, index) => pos === b[index]);
}

function currentBreakPositions(set: DecorationSet): number[] {
  return set.find().map((decoration) => decoration.from);
}

function readPageMetrics(view: EditorView): {
  pageHeight: number;
  margin: number;
  paddingTop: number;
  gap: number;
} {
  const metrics = pageSeamMetricsFromStyles(view.dom.closest("[data-creator-paper]") ?? view.dom);
  const paddingTop = Number.parseFloat(getComputedStyle(view.dom).paddingTop) || metrics.margin;
  return { pageHeight: metrics.pageHeight, margin: metrics.margin, paddingTop, gap: metrics.gap };
}

function applyPageCount(view: EditorView, breakCount: number): void {
  const count = String(Math.max(1, breakCount + 1));
  view.dom.style.setProperty("--creator-page-count", count);
  const paper = view.dom.closest("[data-creator-paper]") as HTMLElement | null;
  paper?.style.setProperty("--creator-page-count", count);
}

function buildDecorations(view: EditorView): DecorationSet {
  const { pageHeight, margin, paddingTop, gap } = readPageMetrics(view);
  const contentHeight = printableContentHeight({ pageHeight, margin, gap });
  const spacerHeight = seamSpacerHeight({ pageHeight, margin, gap });
  const docSize = view.state.doc.content.size;

  const overflow = pauseOverlayHitTesting(view.dom, () => {
    const visualLines = collectLines(view);
    const measured: FlowLine[] = [];
    for (const visual of visualLines) {
      const pos = posForLine(view, visual);
      if (pos == null) {
        continue;
      }
      const spacers = spacerHeightAbove(view.dom, visual.top);
      measured.push({
        pos,
        contentTop: contentOffsetFromVisual(visual.top, paddingTop, spacers),
        contentBottom: contentOffsetFromVisual(visual.bottom, paddingTop, spacers),
      });
    }
    return flowBreakPositions(measured, contentHeight);
  });

  const forced = forcedBreakPositions(view);
  const positions = [...new Set([...overflow, ...forced])]
    .map((pos) => validFlowPos(docSize, pos))
    .filter((pos): pos is number => pos != null)
    .sort((a, b) => a - b);

  const decorations = positions.map((pos) =>
    Decoration.widget(pos, () => createFlowBreakElement(spacerHeight), {
      side: -1,
      ignoreSelection: true,
      key: `flow-break-${pos}`,
    }),
  );
  return DecorationSet.create(view.state.doc, decorations);
}

/**
 * Inserts visual page-gap spacers where overflowing content (including a long
 * text box) must continue on the next sheet. Spacers are decorations, not
 * document nodes, so the original element stays one node for editing and export.
 */
export const PageFlow = Extension.create({
  name: "pageFlow",

  addCommands() {
    return {
      refreshPageFlow:
        () =>
        ({ tr, dispatch, view }) => {
          pendingRefresh.add(view);
          dispatch?.(tr.setMeta("pageFlowRefresh", true).setMeta("addToHistory", false));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decorations, _oldState, newState) {
            const next = tr.getMeta(key);
            if (next instanceof DecorationSet) {
              return next;
            }
            return decorations.map(tr.mapping, newState.doc);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
        view(view) {
          let scheduled = 0;
          let layoutPass = 0;
          let connectRetries = 0;
          let destroyed = false;

          const sync = () => {
            scheduled = 0;
            if (destroyed) {
              return;
            }
            if (!view.dom.isConnected) {
              if (connectRetries < CONNECT_RETRY_FRAMES) {
                connectRetries += 1;
                schedule();
              }
              return;
            }
            connectRetries = 0;

            try {
              const next = buildDecorations(view);
              applyPageCount(view, currentBreakPositions(next).length);
              const prev = key.getState(view.state) ?? DecorationSet.empty;
              const changed = !samePositions(currentBreakPositions(prev), currentBreakPositions(next));
              if (changed) {
                const tr = view.state.tr.setMeta(key, next).setMeta("addToHistory", false);
                view.dispatch(tr);
              }

              // Spacers change layout without changing the document. Keep
              // measuring until positions settle, and always take a couple of
              // extra frames after load so fonts/setContent can finish.
              if (changed || layoutPass < 2) {
                layoutPass += 1;
                if (layoutPass < MAX_LAYOUT_PASSES) {
                  schedule();
                }
                return;
              }
              layoutPass = 0;
            } catch {
              layoutPass += 1;
              if (layoutPass < MAX_LAYOUT_PASSES) {
                schedule();
              }
            }
          };

          const schedule = () => {
            if (scheduled) {
              return;
            }
            scheduled = requestAnimationFrame(() => {
              scheduled = requestAnimationFrame(sync);
            });
          };

          const restart = () => {
            layoutPass = 0;
            schedule();
          };

          restart();
          const observer = new ResizeObserver(restart);
          observer.observe(view.dom);
          const paper = view.dom.closest("[data-creator-paper]");
          if (paper instanceof Element) {
            observer.observe(paper);
          }

          const fonts = view.dom.ownerDocument.fonts;
          void fonts?.ready.then(() => {
            if (view.dom.isConnected) {
              restart();
            }
          });

          return {
            update(_view, prevState) {
              if (pendingRefresh.has(view) || !prevState.doc.eq(view.state.doc)) {
                pendingRefresh.delete(view);
                restart();
              }
            },
            destroy() {
              destroyed = true;
              observer.disconnect();
              if (scheduled) {
                cancelAnimationFrame(scheduled);
              }
            },
          };
        },
      }),
    ];
  },
});

/** Re-measure page gaps after inserting a text box, table, or similar block. */
export function requestPageFlowSync(editor: Editor): void {
  requestAnimationFrame(() => {
    if (!editor.isDestroyed && typeof editor.commands.refreshPageFlow === "function") {
      editor.commands.refreshPageFlow();
    }
  });
}
