/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { FieldOverlay } from "../extensions/field-overlay";
import { FlowGaps } from "../extensions/flow-gaps";
import { SignerField } from "../extensions/signer-field";
import { TextBox } from "../extensions/text-box";
import { insertSignerFieldAtPoint, insertSignerFieldBlock, topLeftPct } from "../insert-signer-field";

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

describe("topLeftPct", () => {
  it("anchors the field top-left at the pointer and keeps it on-page", () => {
    expect(topLeftPct(100, 1000, 0.2)).toBeCloseTo(0.1);
    expect(topLeftPct(0, 1000, 0.2)).toBe(0);
    expect(topLeftPct(950, 1000, 0.2)).toBeCloseTo(0.8);
  });
});

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

describe("insertSignerFieldAtPoint ignores page-thumb clones", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
    document.body.innerHTML = "";
  });

  it("places against the live paper even when a thumb overlay appears first in the DOM", () => {
    const thumb = document.createElement("div");
    thumb.className = "creator-page-thumb";
    thumb.setAttribute("data-creator-thumb", "true");
    thumb.setAttribute("data-field-overlay", "");
    Object.defineProperty(thumb, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 80, height: 100, right: 80, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
    });
    document.body.appendChild(thumb);

    const paper = document.createElement("div");
    paper.setAttribute("data-creator-paper", "");
    paper.style.setProperty("--creator-page-height", "1056px");
    paper.style.setProperty("--creator-page-gap", "0px");
    Object.defineProperty(paper, "getBoundingClientRect", {
      value: () => ({
        left: 200,
        top: 100,
        width: 816,
        height: 2112,
        right: 1016,
        bottom: 2212,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(paper);

    editor = createEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    });
    paper.appendChild(editor.view.dom);

    const ok = insertSignerFieldAtPoint(editor, {
      recipientId: "r1",
      type: "text",
      clientX: 200 + 816 * 0.4,
      clientY: 100 + 1056 + 200,
    });
    expect(ok).toBe(true);

    const field = editor.getJSON().content?.find((n) => n.type === "fieldOverlay")?.content?.[0];
    expect(field?.attrs?.type).toBe("text");
    expect(field?.attrs?.page).toBe(1);
    expect(Number(field?.attrs?.yPct)).toBeGreaterThan(0.1);
    expect(Number(field?.attrs?.yPct)).toBeLessThan(0.35);
  });
});
