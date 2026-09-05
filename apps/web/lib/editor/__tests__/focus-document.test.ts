/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEditorDoc } from "../defaults";
import { focusDocumentStart } from "../focus-document";

function createEditor(content: object) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit],
    content,
  });
}

describe("focusDocumentStart", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("places the caret in a blank document paragraph", () => {
    editor = createEditor(defaultEditorDoc);
    expect(focusDocumentStart(editor)).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.from).toBe(1);
  });

  it("lands in the first textblock of a headed document", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    });
    expect(focusDocumentStart(editor)).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("heading");
    expect(editor.state.selection.$from.parent.textContent).toBe("Title");
  });
});
