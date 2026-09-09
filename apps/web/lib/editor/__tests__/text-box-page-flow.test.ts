/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { PageFlow, createFlowBreakElement } from "../extensions/page-flow";
import { TextBox } from "../extensions/text-box";
import { insertTextBlock, resolveBlockInsertPos } from "../insert-elements";

function createFlowEditor() {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      CreatorDocument,
      StarterKit.configure({ document: false }),
      TextBox,
      PageFlow,
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "textBox",
          content: Array.from({ length: 40 }, (_, i) => ({
            type: "paragraph",
            content: [{ type: "text", text: `Line ${i + 1} of pasted confidentiality agreement content.` }],
          })),
        },
      ],
    },
  });
}

describe("flow Text Block pagination hosting", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("uses a plain contentDOM so PageFlow widgets can land inside the Text Block", () => {
    editor = createFlowEditor();
    let boxPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "textBox") {
        boxPos = pos;
        return false;
      }
      return true;
    });
    expect(boxPos).toBeGreaterThanOrEqual(0);
    const dom = editor.view.nodeDOM(boxPos);
    expect(dom).toBeInstanceOf(HTMLElement);
    expect((dom as HTMLElement).classList.contains("creator-text-box")).toBe(true);
    // Plain node view: the box is the content host, so seam widgets can be
    // siblings of paragraphs inside the same Text Block.
    const breakEl = createFlowBreakElement(128);
    (dom as HTMLElement).appendChild(breakEl);
    expect((dom as HTMLElement).querySelector("[data-creator-flow-break]")).toBeTruthy();
    expect(breakEl.querySelector(".creator-flow-break-label")?.textContent).toBe("Page break");
  });

  it("keeps a single Text Block node after insert (does not split the element)", () => {
    editor = createFlowEditor();
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.child(0).type.name).toBe("textBox");
    expect(editor.state.doc.child(0).childCount).toBe(40);
  });

  it("inserts a new Text Block after the current one instead of nesting", () => {
    editor = createFlowEditor();
    editor.commands.setTextSelection(2);
    expect(resolveBlockInsertPos(editor)).toBe(editor.state.doc.child(0).nodeSize);
    insertTextBlock(editor);
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).type.name).toBe("textBox");
    expect(editor.state.doc.child(1).type.name).toBe("textBox");
  });
});
