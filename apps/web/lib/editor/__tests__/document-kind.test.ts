import { describe, expect, it } from "vitest";
import {
  defaultEditorLayoutForKind,
  editorLayoutForTemplateSource,
  editorLayoutFromVariables,
  withDocumentKindVariables,
} from "../document-kind";

describe("document-kind editor layout", () => {
  it("defaults New Document to Flow, Proposal to Creator, Quote/Invoice to Commercial", () => {
    expect(defaultEditorLayoutForKind("document")).toBe("flow");
    expect(defaultEditorLayoutForKind("proposal")).toBe("creator");
    expect(defaultEditorLayoutForKind("quote")).toBe("commercial");
    expect(defaultEditorLayoutForKind("invoice")).toBe("commercial");
  });

  it("stores layout alongside kind in variables_json", () => {
    expect(withDocumentKindVariables({}, "document")).toEqual({
      document_kind: "document",
      editor_layout: "flow",
    });
    expect(withDocumentKindVariables({}, "proposal")).toEqual({
      document_kind: "proposal",
      editor_layout: "creator",
    });
  });

  it("reads explicit layout and treats missing layout as Creator (legacy)", () => {
    expect(editorLayoutFromVariables({ editor_layout: "flow" })).toBe("flow");
    expect(editorLayoutFromVariables({ document_kind: "document" })).toBe("creator");
    expect(editorLayoutFromVariables({})).toBe("creator");
  });

  it("routes editable DOCX / Flow templates to Flow even for proposal kind", () => {
    expect(
      editorLayoutForTemplateSource({
        kind: "document",
        tags: ["uploaded", "docx", "flow"],
        pageBacked: false,
      }),
    ).toBe("flow");
    expect(
      editorLayoutForTemplateSource({ kind: "proposal", tags: ["docx"], pageBacked: false }),
    ).toBe("flow");
    expect(
      editorLayoutForTemplateSource({
        kind: "document",
        tags: ["uploaded", "docx"],
        pageBacked: true,
      }),
    ).toBe("creator");
    expect(
      editorLayoutForTemplateSource({
        kind: "document",
        tags: ["uploaded", "pdf"],
        pageBacked: true,
      }),
    ).toBe("creator");
  });
});
