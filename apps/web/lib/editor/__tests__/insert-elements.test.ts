/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { TextBox } from "../extensions/text-box";
import { insertHeading, insertVideo, normalizeVideoUrl, topLevelInsertPos } from "../insert-elements";

describe("normalizeVideoUrl", () => {
  it("accepts watch, short, embed and youtu.be URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("rejects non-YouTube links", () => {
    expect(normalizeVideoUrl("https://vimeo.com/123")).toBeNull();
    expect(normalizeVideoUrl("not a url")).toBeNull();
    expect(normalizeVideoUrl("")).toBeNull();
  });
});

describe("insertVideo", () => {
  it("returns false when the editor is missing a valid URL", () => {
    const editor = {
      chain: () => ({
        focus: () => ({
          setYoutubeVideo: () => ({
            run: () => true,
          }),
        }),
      }),
    };
    expect(insertVideo(editor as never, "https://example.com")).toBe(false);
  });
});

describe("insertHeading at a top-level slot", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("pushes an existing text box down instead of merging the heading into it", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, TextBox],
      content: {
        type: "doc",
        content: [
          {
            type: "textBox",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
          },
        ],
      },
    });
    editor.commands.setTextSelection(2);
    expect(topLevelInsertPos(editor, editor.state.selection.from)).toBe(0);
    insertHeading(editor, 2, 0);
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).type.name).toBe("heading");
    expect(editor.state.doc.child(1).type.name).toBe("textBox");
    expect(editor.state.doc.child(1).textContent).toContain("Hello");
  });

  it("inserts after a text box when the slot is the end of that node", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, TextBox],
      content: {
        type: "doc",
        content: [
          {
            type: "textBox",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
          },
        ],
      },
    });
    const after = editor.state.doc.child(0).nodeSize;
    insertHeading(editor, 2, after);
    expect(editor.state.doc.child(0).type.name).toBe("textBox");
    expect(editor.state.doc.child(1).type.name).toBe("heading");
  });
});
