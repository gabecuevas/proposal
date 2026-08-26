/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { FlowGaps, isScaffoldFlowNode } from "../extensions/flow-gaps";
import { TextBox } from "../extensions/text-box";
import { defaultEditorDoc } from "../defaults";

function createEditor(content: object | string) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, TextBox, FlowGaps],
    content,
  });
}

function topTypes(editor: Editor): string[] {
  const types: string[] = [];
  editor.state.doc.forEach((node) => {
    types.push(node.type.name);
  });
  return types;
}

function pressEnter(editor: Editor): void {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  editor.view.someProp("handleKeyDown", (fn) => fn(editor.view, event));
}

describe("flow gaps", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("treats empty paragraphs as scaffold, not content elements", () => {
    expect(isScaffoldFlowNode({ type: { name: "paragraph" }, content: { size: 0 } })).toBe(true);
    expect(isScaffoldFlowNode({ type: { name: "paragraph" }, content: { size: 4 } })).toBe(false);
    expect(isScaffoldFlowNode({ type: { name: "textBox" }, content: { size: 0 } })).toBe(false);
  });

  it("removes empty top-level paragraphs when other elements exist", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        },
        { type: "paragraph" },
      ],
    });
    expect(topTypes(editor)).toEqual(["textBox"]);
  });

  it("keeps Enter inside a text box instead of creating a sibling element", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        },
      ],
    });
    const inside = 2;
    editor.commands.setTextSelection(inside + "Hello".length);
    pressEnter(editor);
    expect(topTypes(editor)).toEqual(["textBox"]);
    expect(editor.state.doc.child(0).childCount).toBe(2);
  });

  it("does not create another text element when Enter is pressed on empty paper below a box", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        },
      ],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size);
    pressEnter(editor);
    expect(topTypes(editor)).toEqual(["textBox"]);
  });

  it("starts from a blank scaffold instead of starter heading and body copy", () => {
    editor = createEditor(defaultEditorDoc);
    expect(topTypes(editor)).toEqual(["paragraph"]);
    expect(editor.getText().trim()).toBe("");
    expect(JSON.stringify(defaultEditorDoc)).not.toContain("Proposal Title");
    expect(JSON.stringify(defaultEditorDoc)).not.toContain("Start writing your proposal");
  });
});
