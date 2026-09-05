/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { FieldCanvas } from "../extensions/field-canvas";
import { FieldOverlay } from "../extensions/field-overlay";
import { PageBreak } from "../extensions/page-break";
import { SignerField } from "../extensions/signer-field";
import { TextBox } from "../extensions/text-box";
import { insertAdjustableTextBox, insertTextBlock } from "../insert-elements";
import {
  canvasForInsertPos,
  collapseOverlayTextBoxSelection,
  isOverlayTextBoxEventTarget,
  isOverlayTextBoxNode,
  isPageBackedSeamInsert,
} from "../overlay-text-box";
import { renderComputedHtml } from "../render";
import type { EditorDoc } from "../types";

function createPageBackedEditor(content?: EditorDoc) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      CreatorDocument,
      StarterKit.configure({ document: false }),
      PageBreak,
      FieldCanvas,
      FieldOverlay,
      SignerField,
      TextBox,
    ],
    content: content ?? {
      type: "doc",
      content: [
        { type: "fieldCanvas", attrs: { bgKey: "p1", pageNumber: 1 } },
        { type: "pageBreak" },
        { type: "fieldCanvas", attrs: { bgKey: "p2", pageNumber: 2 } },
      ],
    },
  });
}

function topTypes(editor: Editor): string[] {
  const types: string[] = [];
  editor.state.doc.forEach((node) => types.push(node.type.name));
  return types;
}

function overlayTextBoxes(editor: Editor) {
  const boxes: Array<{ parent: string; boxId: string }> = [];
  editor.state.doc.descendants((node, _pos, parent) => {
    if (node.type.name === "textBox") {
      boxes.push({
        parent: parent?.type.name ?? "",
        boxId: String(node.attrs.boxId ?? ""),
      });
    }
    return true;
  });
  return boxes;
}

describe("overlay text boxes", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("inserts onto the PDF canvas instead of between pages", () => {
    editor = createPageBackedEditor();
    const before = editor.state.doc.childCount;
    let pageTwoPos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "fieldCanvas" && node.attrs.pageNumber === 2) {
        pageTwoPos = offset;
      }
    });

    expect(canvasForInsertPos(editor, pageTwoPos)?.node.attrs.pageNumber).toBe(2);
    insertAdjustableTextBox(editor, pageTwoPos);
    expect(editor.state.doc.childCount).toBe(before);
    expect(topTypes(editor)).toEqual(["fieldCanvas", "pageBreak", "fieldCanvas"]);
    const boxes = overlayTextBoxes(editor);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.parent).toBe("fieldCanvas");
    expect(boxes[0]?.boxId).toMatch(/^textbox-/);
    expect(editor.state.doc.child(2).childCount).toBe(1);
  });

  it("treats the gap between canvases as a page seam", () => {
    editor = createPageBackedEditor();
    let pageTwoPos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "fieldCanvas" && node.attrs.pageNumber === 2) {
        pageTwoPos = offset;
      }
    });
    expect(isPageBackedSeamInsert(editor, pageTwoPos)).toBe(true);
  });

  it("still inserts a flow text box when the document has no canvas or overlay schema", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, TextBox],
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    insertTextBlock(editor);
    expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(1);
    expect(editor.state.doc.child(0).type.name === "textBox" || editor.state.doc.child(1)?.type.name === "textBox").toBe(
      true,
    );
    const box = editor.state.doc.child(0).type.name === "textBox" ? editor.state.doc.child(0) : editor.state.doc.child(1);
    expect(isOverlayTextBoxNode(box)).toBe(false);
  });

  it("places a flowing-doc text box as a full-width Text Block", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        CreatorDocument,
        StarterKit.configure({ document: false }),
        FieldOverlay,
        SignerField,
        TextBox,
      ],
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] },
    });
    insertTextBlock(editor);
    const overlayBoxes = overlayTextBoxes(editor).filter((box) => Boolean(box.boxId));
    expect(overlayBoxes).toHaveLength(0);
    let flowBox = false;
    editor.state.doc.descendants((node, _pos, parent) => {
      if (node.type.name === "textBox" && !String(node.attrs.boxId ?? "") && parent?.type.name === "doc") {
        flowBox = true;
      }
      return true;
    });
    expect(flowBox).toBe(true);
    expect(editor.state.doc.textContent).toContain("Hello");
  });

  it("collapses the caret out of an overlay text box", () => {
    editor = createPageBackedEditor();
    insertAdjustableTextBox(editor);
    let boxPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (isOverlayTextBoxNode(node)) {
        boxPos = pos;
        return false;
      }
      return true;
    });
    expect(boxPos).toBeGreaterThanOrEqual(0);
    editor.commands.setTextSelection(boxPos + 2);
    const insideBefore = (() => {
      const $from = editor.state.selection.$from;
      for (let depth = $from.depth; depth > 0; depth--) {
        if (isOverlayTextBoxNode($from.node(depth))) {
          return true;
        }
      }
      return false;
    })();
    expect(insideBefore).toBe(true);
    const tr = collapseOverlayTextBoxSelection(editor.state);
    expect(tr).not.toBeNull();
    editor.view.dispatch(tr!);
    let inside = false;
    const $from = editor.state.selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      if (isOverlayTextBoxNode($from.node(depth))) {
        inside = true;
      }
    }
    expect(inside).toBe(false);
    expect(editor.state.selection instanceof NodeSelection).toBe(true);
  });

  it("does not move the caret into a sibling overlay text box", () => {
    editor = createPageBackedEditor();
    insertAdjustableTextBox(editor);
    insertAdjustableTextBox(editor);
    const boxes: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (isOverlayTextBoxNode(node)) {
        boxes.push(pos);
        return false;
      }
      return true;
    });
    expect(boxes).toHaveLength(2);
    editor.commands.setTextSelection(boxes[0]! + 2);
    const tr = collapseOverlayTextBoxSelection(editor.state);
    expect(tr).not.toBeNull();
    editor.view.dispatch(tr!);
    let inside = false;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection) {
      inside = isOverlayTextBoxNode(selection.node);
    }
    const $from = selection.$from;
    for (let depth = $from.depth; depth > 0; depth--) {
      if (isOverlayTextBoxNode($from.node(depth))) {
        inside = true;
      }
    }
    expect(inside).toBe(false);
  });

  it("treats overlay chrome as a keep-selection target", () => {
    const box = document.createElement("div");
    box.className = "overlay-text-box";
    const inner = document.createElement("span");
    box.append(inner);
    expect(isOverlayTextBoxEventTarget(inner)).toBe(true);
    expect(isOverlayTextBoxEventTarget(document.createElement("div"))).toBe(false);
  });
});

describe("render overlay text boxes", () => {
  it("positions a canvas text box without taking flow space", () => {
    const html = renderComputedHtml({
      doc: {
        type: "doc",
        content: [
          {
            type: "fieldCanvas",
            attrs: { bgKey: "page.jpg", pageNumber: 1 },
            content: [
              {
                type: "textBox",
                attrs: { boxId: "textbox-1", xPct: 0.1, yPct: 0.2, wPct: 0.4, hPct: 0.08, page: 0 },
                content: [{ type: "paragraph", content: [{ type: "text", text: "On the page" }] }],
              },
            ],
          },
        ],
      },
      mode: "sender-preview",
      resolvedVariables: {},
      signerFieldValues: [],
    });
    expect(html).toContain("rendered-overlay-text-box");
    expect(html).toContain("--field-x:0.1");
    expect(html).toContain("--field-y:0.2");
    expect(html).toContain("On the page");
    expect(html).not.toMatch(/<div class="creator-text-box"/);
  });
});
