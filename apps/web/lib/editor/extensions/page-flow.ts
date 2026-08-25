import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { pageContentHeightPx } from "../page-geometry";
import { contentOffsetFromVisual, flowBreakPositions, type FlowLine } from "../page-flow";

const key = new PluginKey<DecorationSet>("pageFlow");
const SKIP_SELECTOR =
  ".creator-flow-break, .field-overlay, [data-field-overlay], .signer-field-node, .ProseMirror-widget";

type VisualLine = { top: number; bottom: number; left: number };

function isSkipped(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return Boolean(el?.closest(SKIP_SELECTOR));
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
        return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
      if (node instanceof Element) {
        if (
          node.matches(
            "img, table, hr, [data-node-type='pageBreak'], [data-page-break], [data-youtube-video], .creator-image-block",
          )
        ) {
          return NodeFilter.FILTER_ACCEPT;
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
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.height < 1 || rect.width < 1) {
          continue;
        }
        boxes.push({
          top: rect.top - rootRect.top,
          bottom: rect.bottom - rootRect.top,
          left: rect.left,
        });
      }
    } else if (node instanceof Element) {
      const rect = node.getBoundingClientRect();
      if (rect.height < 1) {
        continue;
      }
      boxes.push({
        top: rect.top - rootRect.top,
        bottom: rect.bottom - rootRect.top,
        left: rect.left,
      });
    }
  }

  boxes.sort((a, b) => a.top - b.top || a.left - b.left);
  return boxes;
}

function spacerHeightAbove(root: HTMLElement, visualY: number): number {
  let height = 0;
  const rootTop = root.getBoundingClientRect().top;
  for (const el of root.querySelectorAll(".creator-flow-break")) {
    const rect = el.getBoundingClientRect();
    const top = rect.top - rootTop;
    if (top + 1 < visualY) {
      height += rect.height;
    }
  }
  return height;
}

function posForLine(
  view: EditorView,
  line: { top: number; bottom: number; left: number },
): number | null {
  const rootRect = view.dom.getBoundingClientRect();
  const coords = view.posAtCoords({
    left: line.left + 2,
    top: rootRect.top + line.top + Math.min(4, (line.bottom - line.top) / 2),
  });
  if (!coords) {
    return null;
  }
  const $pos = view.state.doc.resolve(coords.pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "fieldOverlay") {
      return null;
    }
  }
  return coords.pos;
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

function makeSpacer(): HTMLElement {
  const el = document.createElement("div");
  el.className = "creator-flow-break";
  el.setAttribute("data-creator-flow-break", "true");
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  el.style.background = "transparent";
  el.style.boxShadow = "none";
  el.style.width = "100%";
  el.style.left = "0";
  el.style.transform = "none";
  el.style.position = "static";
  return el;
}

function samePositions(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((pos, index) => pos === b[index]);
}

function currentBreakPositions(set: DecorationSet): number[] {
  return set.find().map((decoration) => decoration.from);
}

function readPageMetrics(view: EditorView): { pageHeight: number; margin: number; paddingTop: number } {
  const editorStyles = getComputedStyle(view.dom);
  const paper = view.dom.closest("[data-creator-paper]") as HTMLElement | null;
  const paperStyles = paper ? getComputedStyle(paper) : editorStyles;
  const pageHeight =
    Number.parseFloat(paperStyles.getPropertyValue("--creator-page-height")) ||
    Number.parseFloat(editorStyles.minHeight) ||
    1056;
  const margin =
    Number.parseFloat(paperStyles.getPropertyValue("--creator-page-margin")) ||
    Number.parseFloat(editorStyles.paddingTop) ||
    48;
  const paddingTop = Number.parseFloat(editorStyles.paddingTop) || margin;
  return { pageHeight, margin, paddingTop };
}

function applyPageCount(view: EditorView, breakCount: number): void {
  const count = String(Math.max(1, breakCount + 1));
  view.dom.style.setProperty("--creator-page-count", count);
  const paper = view.dom.closest("[data-creator-paper]") as HTMLElement | null;
  paper?.style.setProperty("--creator-page-count", count);
}

function buildDecorations(view: EditorView): DecorationSet {
  const { pageHeight, margin, paddingTop } = readPageMetrics(view);
  const contentHeight = pageContentHeightPx(pageHeight, margin);
  const visualLines = collectLines(view);
  const lines: FlowLine[] = [];

  for (const visual of visualLines) {
    const pos = posForLine(view, visual);
    if (pos == null) {
      continue;
    }
    const spacers = spacerHeightAbove(view.dom, visual.top);
    lines.push({
      pos,
      contentTop: contentOffsetFromVisual(visual.top, paddingTop, spacers),
      contentBottom: contentOffsetFromVisual(visual.bottom, paddingTop, spacers),
    });
  }

  const overflow = flowBreakPositions(lines, contentHeight);
  const forced = forcedBreakPositions(view);
  const positions = [...new Set([...overflow, ...forced])].filter((pos) => pos > 1 && pos < view.state.doc.content.size).sort(
    (a, b) => a - b,
  );

  const decorations = positions.map((pos) =>
    Decoration.widget(pos, makeSpacer, { side: -1, ignoreSelection: true, key: `flow-break-${pos}` }),
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

  addProseMirrorPlugins() {
    let scheduled = 0;

    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decorations, _oldState, newState) {
            const next = tr.getMeta(key) as DecorationSet | undefined;
            if (next) {
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
          const sync = () => {
            scheduled = 0;
            if (!view.dom.isConnected) {
              return;
            }
            const next = buildDecorations(view);
            applyPageCount(view, currentBreakPositions(next).length);
            const prev = key.getState(view.state) ?? DecorationSet.empty;
            if (samePositions(currentBreakPositions(prev), currentBreakPositions(next))) {
              return;
            }
            const tr = view.state.tr.setMeta(key, next).setMeta("addToHistory", false);
            view.dispatch(tr);
          };

          const schedule = () => {
            if (scheduled) {
              return;
            }
            scheduled = requestAnimationFrame(sync);
          };

          schedule();
          const observer = new ResizeObserver(schedule);
          observer.observe(view.dom);

          return {
            update(_view, prevState) {
              if (!prevState.doc.eq(view.state.doc)) {
                schedule();
              }
            },
            destroy() {
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
