/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { FieldOverlay } from "../extensions/field-overlay";
import { PageBreak } from "../extensions/page-break";
import { QuoteTable } from "../extensions/quote-table";
import { SignerField } from "../extensions/signer-field";
import {
  canDeletePage,
  clonePageNodeJson,
  collectPageBlocks,
  deleteVisualPage,
  duplicateVisualPage,
  pageLibraryPayload,
  splitTopLevelByPageBreaks,
} from "../page-actions";
import { parsePageBackgrounds } from "../page-backgrounds";
import type { EditorDoc, EditorNode } from "../types";

function overlayFields(doc: EditorDoc): EditorNode[] {
  const overlay = doc.content.find((node) => node.type === "fieldOverlay");
  return overlay?.content ?? [];
}

function types(doc: EditorDoc): string[] {
  return (doc.content ?? []).map((node) => node.type);
}

function texts(doc: EditorDoc): string[] {
  return (doc.content ?? [])
    .filter((node) => node.type === "paragraph")
    .map((node) => node.content?.[0]?.text ?? "");
}

function fieldPages(doc: EditorDoc): Array<{ fieldId: string; page: number }> {
  return overlayFields(doc).map((field) => ({
    fieldId: String(field.attrs?.fieldId ?? ""),
    page: Number(field.attrs?.page ?? 0),
  }));
}

function createEditor(content: EditorDoc) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      CreatorDocument,
      StarterKit.configure({ document: false }),
      PageBreak,
      FieldOverlay,
      SignerField,
      QuoteTable,
    ],
    content,
  });
}

const twoPageDoc: EditorDoc = {
  type: "doc",
  attrs: {
    pageBackgrounds: {
      "0": { color: "#dc2626", colorOpacity: 100 },
      "1": { color: "#1d4ed8", colorOpacity: 100 },
    },
  },
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Cover" }] },
    { type: "pageBreak" },
    { type: "paragraph", content: [{ type: "text", text: "Terms" }] },
    {
      type: "fieldOverlay",
      content: [
        {
          type: "signerField",
          attrs: {
            fieldId: "field-cover",
            recipientId: "r1",
            type: "signature",
            page: 0,
          },
        },
        {
          type: "signerField",
          attrs: {
            fieldId: "field-terms",
            recipientId: "r1",
            type: "date",
            page: 1,
          },
        },
      ],
    },
  ],
};

describe("page node cloning", () => {
  it("gives signer fields new ids and keeps quote table ids so pricing still matches", () => {
    const cloned = clonePageNodeJson({
      type: "fieldCanvas",
      attrs: { bgKey: "page.png" },
      content: [
        { type: "signerField", attrs: { fieldId: "field-a", page: 0 } },
        { type: "quoteTable", attrs: { tableId: "default" } },
      ],
    });
    expect(cloned.content?.[0]?.attrs?.fieldId).not.toBe("field-a");
    expect(String(cloned.content?.[0]?.attrs?.fieldId)).toMatch(/^field-/);
    expect(cloned.content?.[1]?.attrs?.tableId).toBe("default");
    expect(cloned.attrs?.bgKey).toBe("page.png");
  });
});

describe("page actions", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("splits top-level nodes on page breaks and skips the overlay", () => {
    editor = createEditor(twoPageDoc);
    const pages = splitTopLevelByPageBreaks(editor.state.doc);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.map((block) => block.json.content?.[0]?.text)).toEqual(["Cover"]);
    expect(pages[1]?.map((block) => block.json.content?.[0]?.text)).toEqual(["Terms"]);
    expect(collectPageBlocks(editor, null, 0)).toHaveLength(1);
    expect(collectPageBlocks(editor, null, 1)).toHaveLength(1);
  });

  it("duplicates a page including content, background, and fillable fields", () => {
    editor = createEditor(twoPageDoc);
    expect(duplicateVisualPage(editor, null, 0)).toBe(true);
    const json = editor.getJSON() as EditorDoc;
    expect(texts(json)).toEqual(["Cover", "Cover", "Terms"]);
    expect(types(json).filter((type) => type === "pageBreak")).toHaveLength(2);
    const backgrounds = parsePageBackgrounds(json.attrs?.pageBackgrounds);
    expect(backgrounds["0"]?.color).toBe("#dc2626");
    expect(backgrounds["1"]?.color).toBe("#dc2626");
    expect(backgrounds["2"]?.color).toBe("#1d4ed8");
    const fields = fieldPages(json);
    expect(fields).toHaveLength(3);
    expect(fields.filter((field) => field.page === 0).map((field) => field.fieldId)).toEqual(["field-cover"]);
    const clonedCover = fields.find((field) => field.page === 1);
    expect(clonedCover?.fieldId).not.toBe("field-cover");
    expect(fields.find((field) => field.fieldId === "field-terms")?.page).toBe(2);
  });

  it("duplicates the last page after a trailing page break", () => {
    editor = createEditor(twoPageDoc);
    expect(duplicateVisualPage(editor, null, 1)).toBe(true);
    const json = editor.getJSON() as EditorDoc;
    expect(texts(json)).toEqual(["Cover", "Terms", "Terms"]);
    const fields = fieldPages(json);
    expect(fields.find((field) => field.fieldId === "field-cover")?.page).toBe(0);
    expect(fields.find((field) => field.fieldId === "field-terms")?.page).toBe(1);
    expect(fields.filter((field) => field.page === 2)).toHaveLength(1);
  });

  it("deletes a page and shifts later backgrounds and fields down", () => {
    editor = createEditor(twoPageDoc);
    expect(canDeletePage(2)).toBe(true);
    expect(deleteVisualPage(editor, null, 0, 2)).toBe(true);
    const json = editor.getJSON() as EditorDoc;
    expect(texts(json)).toEqual(["Terms"]);
    expect(types(json)).not.toContain("pageBreak");
    expect(parsePageBackgrounds(json.attrs?.pageBackgrounds)["0"]?.color).toBe("#1d4ed8");
    expect(fieldPages(json)).toEqual([{ fieldId: "field-terms", page: 0 }]);
  });

  it("does not delete the last remaining page", () => {
    editor = createEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Only" }] }],
    });
    expect(canDeletePage(1)).toBe(false);
    expect(deleteVisualPage(editor, null, 0, 1)).toBe(false);
    expect(texts(editor.getJSON() as EditorDoc)).toEqual(["Only"]);
  });

  it("builds a content-library payload from the page body, not the overlay", () => {
    editor = createEditor(twoPageDoc);
    const payload = pageLibraryPayload(editor, null, 0);
    expect(payload.name).toBe("Cover");
    expect(payload.block_type).toBe("text");
    expect(payload.editor_json.content.map((node) => node.type)).toEqual(["paragraph"]);
    expect(payload.editor_json.content.some((node) => node.type === "fieldOverlay")).toBe(false);
  });
});
