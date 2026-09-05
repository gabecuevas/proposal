/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { FieldOverlay } from "../extensions/field-overlay";
import { FlowGaps } from "../extensions/flow-gaps";
import { SignerField } from "../extensions/signer-field";
import { TextBox } from "../extensions/text-box";
import { insertSignerFieldBlock } from "../insert-signer-field";

function createEditor(content: object) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      CreatorDocument,
      StarterKit.configure({ document: false }),
      TextBox,
      SignerField,
      FieldOverlay,
      FlowGaps,
    ],
    content,
  });
}

describe("insertSignerFieldBlock over Text Blocks", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("places a text field on the overlay without splitting the Text Block", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Date: ________" }] },
            { type: "paragraph", content: [{ type: "text", text: "Signature line" }] },
          ],
        },
      ],
    });
    editor.commands.setTextSelection(4);
    expect(editor.isActive("textBox")).toBe(true);

    const ok = insertSignerFieldBlock(editor, {
      recipientId: "recipient-1",
      type: "text",
      xPct: 0.45,
      yPct: 0.22,
      page: 0,
    });
    expect(ok).toBe(true);

    const json = editor.getJSON();
    expect(json.content?.map((n) => n.type)).toEqual(["textBox", "fieldOverlay"]);
    expect(json.content?.[0]?.content).toHaveLength(2);
    expect(json.content?.[0]?.textContent ?? json.content?.[0]?.content?.[0]).toBeTruthy();

    const overlay = json.content?.find((n) => n.type === "fieldOverlay");
    expect(overlay?.content).toHaveLength(1);
    expect(overlay?.content?.[0]?.type).toBe("signerField");
    expect(overlay?.content?.[0]?.attrs?.type).toBe("text");
    expect(overlay?.content?.[0]?.attrs?.xPct).toBeCloseTo(0.45);
    expect(overlay?.content?.[0]?.attrs?.yPct).toBeCloseTo(0.22);
  });

  it("creates the overlay and first field in one step (no empty overlay left behind)", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Party A ______" }] }],
        },
      ],
    });
    expect(
      insertSignerFieldBlock(editor, { recipientId: "r1", type: "date", xPct: 0.2, yPct: 0.1, page: 0 }),
    ).toBe(true);
    const overlay = editor.getJSON().content?.find((n) => n.type === "fieldOverlay");
    expect(overlay?.content?.length).toBe(1);
    expect(overlay?.content?.[0]?.attrs?.type).toBe("date");
  });

  it("keeps stacking more overlay fields without touching the Text Block body", () => {
    editor = createEditor({
      type: "doc",
      content: [
        {
          type: "textBox",
          content: [{ type: "paragraph", content: [{ type: "text", text: "NDA body" }] }],
        },
      ],
    });
    editor.commands.setTextSelection(3);
    expect(insertSignerFieldBlock(editor, { recipientId: "r1", type: "date" })).toBe(true);
    expect(insertSignerFieldBlock(editor, { recipientId: "r1", type: "signature" })).toBe(true);
    expect(insertSignerFieldBlock(editor, { recipientId: "r2", type: "text" })).toBe(true);

    const json = editor.getJSON();
    expect(json.content?.filter((n) => n.type === "textBox")).toHaveLength(1);
    expect(json.content?.find((n) => n.type === "textBox")?.content).toHaveLength(1);
    expect(json.content?.find((n) => n.type === "fieldOverlay")?.content).toHaveLength(3);
  });
});
