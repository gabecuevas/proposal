/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { commitSignerFieldPlaceholder, storedFieldText } from "../commit-signer-field-text";
import { CreatorDocument } from "../extensions/creator-document";
import { FieldCanvas } from "../extensions/field-canvas";
import { SignerField } from "../extensions/signer-field";
import { TextBox } from "../extensions/text-box";

function createEditor() {
  return new Editor({
    element: document.createElement("div"),
    extensions: [CreatorDocument, StarterKit.configure({ document: false }), FieldCanvas, SignerField, TextBox],
    content: {
      type: "doc",
      content: [
        {
          type: "fieldCanvas",
          content: [
            {
              type: "signerField",
              attrs: {
                fieldId: "field-text",
                type: "text",
                placeholder: "Enter text...",
              },
            },
          ],
        },
      ],
    },
  });
}

function fieldPos(editor: Editor): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "signerField") {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

describe("commitSignerFieldPlaceholder", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("treats the default hint as empty stored text", () => {
    expect(storedFieldText("Enter text...")).toBe("");
    expect(storedFieldText("Hello")).toBe("Hello");
  });

  it("writes typed text onto the field after selection has moved away", () => {
    editor = createEditor();
    const pos = fieldPos(editor);
    expect(commitSignerFieldPlaceholder(editor, pos, "Saved without Enter")).toBe(true);
    expect(editor.state.doc.nodeAt(pos)?.attrs.placeholder).toBe("Saved without Enter");
  });
});
