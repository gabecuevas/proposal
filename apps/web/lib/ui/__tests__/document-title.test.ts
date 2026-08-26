import { describe, expect, it } from "vitest";
import { applyTitleToDoc, documentTitleFromEditorJson } from "../document-title";
import type { EditorDoc } from "@/lib/editor/types";

const loremDoc: EditorDoc = {
  type: "doc",
  content: [
    {
      type: "textBox",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Lorem ipsum dolor sit amet" }] }],
    },
  ],
};

describe("documentTitleFromEditorJson", () => {
  it("uses the saved title even when the first block has other text", () => {
    expect(
      documentTitleFromEditorJson({
        ...loremDoc,
        attrs: { title: "Acme proposal" },
      }),
    ).toBe("Acme proposal");
  });

  it("falls back to the first line when no title is stored", () => {
    expect(documentTitleFromEditorJson(loremDoc)).toBe("Lorem ipsum dolor sit amet");
  });
});

describe("applyTitleToDoc", () => {
  it("stores the title on doc attrs", () => {
    const next = applyTitleToDoc(loremDoc, "  Q3 proposal  ");
    expect(next.attrs?.title).toBe("Q3 proposal");
    expect(documentTitleFromEditorJson(next)).toBe("Q3 proposal");
  });
});
