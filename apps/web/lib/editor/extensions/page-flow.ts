import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { isPageBackedDoc } from "./field-canvas";
import { canvasSeamPositions } from "../page-flow";
import {
  flowSpacerHeightForBreak,
  pageSeamMetricsFromStyles,
  seamSpacerHeight,
  validFlowPos,
} from "../page-seam";
import { pageCountForHeight } from "../page-geometry";

const key = new PluginKey<DecorationSet>("pageFlow");
const pendingRefresh = new WeakSet<EditorView>();
/** Docs that need a full seam remeasure after a replace that dropped widgets. */
const docsNeedingRemeasure = new WeakSet<object>();
const OVERLAY_HIT_SELECTOR = ".field-overlay, [data-field-overlay], .signer-field-node, .overlay-text-box";
const MAX_LAYOUT_PASSES = 12;
const CONNECT_RETRY_FRAMES = 30;
const HEIGHT_QUANTUM_PX = 2;
const RESIZE_DEBOUNCE_MS = 48;

function quantizeSpacerHeight(heightPx: number): number {
  return Math.max(HEIGHT_QUANTUM_PX, Math.round(heightPx / HEIGHT_QUANTUM_PX) * HEIGHT_QUANTUM_PX);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageFlow: {
      refreshPageFlow: () => ReturnType;
    };
  }
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

/**
 * @deprecated Flow docs no longer collapse live spacers — kept for tests.
 */
export function pauseFlowBreaksForMeasure<T>(root: ParentNode, run: () => T): T {
  return run();
}

function nodeAfterIsFieldCanvas(view: EditorView, pos: number): boolean {
  try {
    return view.state.doc.resolve(pos).nodeAfter?.type.name === "fieldCanvas";
  } catch {
    return false;
  }
}

function decorationSignature(set: DecorationSet): string {
  return set
    .find()
    .map((decoration) => String(decoration.spec.key ?? decoration.from))
    .join("|");
}

export function createFlowBreakElement(heightPx: number): HTMLElement {
  const el = document.createElement("span");
  el.className = "creator-flow-break";
  el.setAttribute("data-creator-flow-break", "true");
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  const height = `${Math.max(0, Math.round(heightPx))}px`;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = height;
  el.style.minHeight = height;
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.lineHeight = "0";
  el.style.fontSize = "0";
  el.style.overflow = "visible";
  el.style.clear = "both";
  el.style.pointerEvents = "none";
  el.style.position = "relative";
  el.style.left = "0";
  el.style.transform = "none";
  el.style.background = "transparent";
  el.style.boxShadow = "none";
  el.style.breakBefore = "auto";

  const label = document.createElement("span");
  label.className = "creator-flow-break-label";
  label.textContent = "Page break";
  el.appendChild(label);
  return el;
}

function currentBreakPositions(set: DecorationSet): number[] {
  return set.find().map((decoration) => decoration.from);
}

function readPageMetrics(view: EditorView): {
  pageHeight: number;
  margin: number;
  gap: number;
} {
  const metrics = pageSeamMetricsFromStyles(view.dom.closest("[data-creator-paper]") ?? view.dom);
  return { pageHeight: metrics.pageHeight, margin: metrics.margin, gap: metrics.gap };
}

function applyPageCount(view: EditorView, pageCount: number): void {
  const count = String(Math.max(1, pageCount));
  view.dom.style.setProperty("--creator-page-count", count);
  const paper = view.dom.closest("[data-creator-paper]") as HTMLElement | null;
  paper?.style.setProperty("--creator-page-count", count);
}

function applyPageBacked(view: EditorView): void {
  const pageBacked = isPageBackedDoc(view.state.doc);
  const dom = view.dom as HTMLElement;
  dom.classList.toggle("is-page-backed", pageBacked);
  const paper = view.dom.closest("[data-creator-paper]") as HTMLElement | null;
  paper?.classList.toggle("is-page-backed", pageBacked);
  if (pageBacked) {
    dom.style.padding = "0px";
    dom.style.setProperty("--field-canvas-height", "var(--creator-page-height, 1056px)");
  } else {
    dom.style.padding = "";
    dom.style.removeProperty("--field-canvas-height");
  }
}

/**
 * Flow docs: continuous canvas — no height-pushing overflow spacers.
 * Page count comes from content height; estimated breaks are paper overlays.
 *
 * Page-backed PDF uploads: grey-gap spacers between page canvases only.
 */
function buildDecorations(view: EditorView): DecorationSet {
  const { pageHeight, margin, gap } = readPageMetrics(view);
  const spacerHeight = seamSpacerHeight({ pageHeight, margin, gap });
  const docSize = view.state.doc.content.size;
  const pageBacked = isPageBackedDoc(view.state.doc);

  if (!pageBacked) {
    applyPageCount(view, pageCountForHeight(view.dom.scrollHeight, pageHeight));
    return DecorationSet.empty;
  }

  const topLevel: { type: string; pos: number }[] = [];
  view.state.doc.forEach((node, pos) => {
    topLevel.push({ type: node.type.name, pos });
  });
  const positions = canvasSeamPositions(topLevel)
    .map((pos) => validFlowPos(docSize, pos))
    .filter((pos): pos is number => pos != null);

  const decorations = positions.map((pos) => {
    const height = quantizeSpacerHeight(
      flowSpacerHeightForBreak({
        pageBacked: true,
        followingIsPageCanvas: nodeAfterIsFieldCanvas(view, pos),
        measuredBottomPx: null,
        pageHeightPx: pageHeight,
        gapPx: gap,
        marginPx: margin,
        defaultSeamPx: spacerHeight,
      }),
    );
    return Decoration.widget(pos, () => createFlowBreakElement(height), {
      side: -1,
      ignoreSelection: true,
      key: `flow-break-${pos}-${height}`,
    });
  });
  applyPageCount(view, Math.max(1, positions.length + 1));
  return DecorationSet.create(view.state.doc, decorations);
}

/**
 * PageFlow: page-backed PDF seams + flow page-count sync.
 * Flow documents use a continuous white canvas; estimated page breaks are
 * drawn by CreatorCanvas overlays — not ProseMirror spacer widgets.
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
          apply(tr, decorations, oldState, newState) {
            const next = tr.getMeta(key);
            if (next instanceof DecorationSet) {
              return next;
            }
            if (tr.docChanged) {
              if (oldState.doc.eq(newState.doc)) {
                docsNeedingRemeasure.add(newState.doc);
                return DecorationSet.empty;
              }
              return decorations.map(tr.mapping, newState.doc);
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
          let resizeTimer = 0;
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
              applyPageBacked(view);
              const next = buildDecorations(view);
              const prev = key.getState(view.state) ?? DecorationSet.empty;
              const changed = decorationSignature(prev) !== decorationSignature(next);
              if (changed) {
                const tr = view.state.tr.setMeta(key, next).setMeta("addToHistory", false);
                view.dispatch(tr);
              }

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

          const restartFromResize = () => {
            if (destroyed) {
              return;
            }
            if (resizeTimer) {
              window.clearTimeout(resizeTimer);
            }
            resizeTimer = window.setTimeout(() => {
              resizeTimer = 0;
              restart();
            }, RESIZE_DEBOUNCE_MS);
          };

          restart();
          const observer = new ResizeObserver(restartFromResize);
          observer.observe(view.dom);
          const paper = view.dom.closest("[data-creator-paper]");
          if (paper instanceof Element) {
            observer.observe(paper);
          }

          const onPaste = () => {
            window.setTimeout(() => {
              if (!destroyed && view.dom.isConnected) {
                restart();
              }
            }, 160);
          };
          view.dom.addEventListener("paste", onPaste);

          const fonts = view.dom.ownerDocument.fonts;
          void fonts?.ready.then(() => {
            if (view.dom.isConnected) {
              restart();
            }
          });

          const bootTimers = [0, 120].map((ms) =>
            window.setTimeout(() => {
              if (!destroyed && view.dom.isConnected) {
                restart();
              }
            }, ms),
          );

          return {
            update(_view, prevState) {
              if (
                pendingRefresh.has(view) ||
                docsNeedingRemeasure.has(view.state.doc) ||
                !prevState.doc.eq(view.state.doc)
              ) {
                pendingRefresh.delete(view);
                docsNeedingRemeasure.delete(view.state.doc);
                restart();
              }
            },
            destroy() {
              destroyed = true;
              observer.disconnect();
              view.dom.removeEventListener("paste", onPaste);
              for (const timer of bootTimers) {
                window.clearTimeout(timer);
              }
              if (resizeTimer) {
                window.clearTimeout(resizeTimer);
              }
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
