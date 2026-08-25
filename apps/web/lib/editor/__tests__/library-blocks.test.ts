import { describe, expect, it } from "vitest";
import {
  defaultLibraryName,
  libraryCategoryForType,
  libraryCategoryLabel,
  resolveLibraryCategory,
  sliceNodeToDoc,
} from "../library-blocks";
import type { EditorNode } from "../types";

describe("library-blocks", () => {
  it("categorizes node types for the content library", () => {
    expect(libraryCategoryForType("textBox")).toBe("text");
    expect(libraryCategoryForType("heading")).toBe("text");
    expect(libraryCategoryForType("image")).toBe("image");
    expect(libraryCategoryForType("youtube")).toBe("video");
    expect(libraryCategoryForType("table")).toBe("table");
    expect(libraryCategoryForType("quoteTable")).toBe("table");
    expect(libraryCategoryForType("fieldCanvas")).toBe("image");
    expect(libraryCategoryLabel("video")).toBe("Video");
    expect(libraryCategoryLabel("table")).toBe("Tables");
    expect(libraryCategoryLabel("image")).toBe("Images");
  });

  it("slices a single element into a reusable document", () => {
    const node: EditorNode = {
      type: "textBox",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello library" }] }],
    };
    expect(sliceNodeToDoc(node)).toEqual({ type: "doc", content: [node] });
    expect(defaultLibraryName(node)).toBe("Hello library");
    expect(defaultLibraryName({ type: "image" })).toBe("Images");
    expect(resolveLibraryCategory("clause")).toBe("text");
    expect(resolveLibraryCategory("video")).toBe("video");
  });
});
