/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CreatorDocument } from "../extensions/creator-document";
import { parsePageBackgrounds } from "../page-backgrounds";

function createEditor() {
  return new Editor({
    element: document.createElement("div"),
    extensions: [CreatorDocument, StarterKit.configure({ document: false })],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] },
  });
}

describe("creator document page backgrounds", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("stores a page color on doc attrs so save/load keep it", () => {
    editor = createEditor();
    expect(editor.commands.setPageBackground(0, { color: "#dc2626", colorOpacity: 100 })).toBe(true);
    const json = editor.getJSON();
    expect(parsePageBackgrounds(json.attrs?.pageBackgrounds)["0"]).toEqual({
      color: "#dc2626",
      colorOpacity: 100,
    });
    expect(editor.commands.setPageBackground(0, { imageKey: "workspaces/w/uploads/bg.png" })).toBe(true);
    expect(parsePageBackgrounds(editor.getJSON().attrs?.pageBackgrounds)["0"]?.imageKey).toBe(
      "workspaces/w/uploads/bg.png",
    );
    expect(editor.commands.clearPageBackground(0)).toBe(true);
    expect(parsePageBackgrounds(editor.getJSON().attrs?.pageBackgrounds)).toEqual({});
  });
});
