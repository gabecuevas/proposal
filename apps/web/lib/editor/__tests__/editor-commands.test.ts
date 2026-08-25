/** @vitest-environment happy-dom */

import { Editor } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
  getBlockStyle,
  getEditorFormatState,
  setAlignment,
  setBlockStyle,
  setHighlightColor,
  setLinkHref,
  toggleBold,
  toggleBulletList,
  toggleItalic,
  toggleUnderline,
  undo,
} from "../commands/editor-commands";
import { FontSize } from "../extensions/font-size";
import { Indent } from "../extensions/indent";
import { LineHeight } from "../extensions/line-height";
import { PageBreak } from "../extensions/page-break";
import { QuoteTable } from "../extensions/quote-table";
import { VariableToken } from "../extensions/variable-token";
import { insertQuoteTable, insertVariable } from "../insert-elements";
import { serializeStable } from "../stable";
import type { EditorDoc } from "../types";

function createEditor(content = "<p>Hello world</p>") {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      LineHeight,
      Indent,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      PageBreak,
      QuoteTable,
      VariableToken,
    ],
    content,
  });
}

describe("editor format commands", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("toggles bold, italic, underline and reports toolbar state", () => {
    editor = createEditor();
    editor.commands.selectAll();
    expect(toggleBold(editor)).toBe(true);
    expect(toggleItalic(editor)).toBe(true);
    expect(toggleUnderline(editor)).toBe(true);
    const state = getEditorFormatState(editor);
    expect(state.bold).toBe(true);
    expect(state.italic).toBe(true);
    expect(state.underline).toBe(true);
    expect(state.blockStyle).toBe("paragraph");
  });

  it("sets heading style, alignment, lists, highlight, and links", () => {
    editor = createEditor();
    editor.commands.selectAll();
    expect(setBlockStyle(editor, "h2")).toBe(true);
    expect(getBlockStyle(editor)).toBe("h2");
    expect(setAlignment(editor, "center")).toBe(true);
    expect(getEditorFormatState(editor).align).toBe("center");
    expect(toggleBulletList(editor)).toBe(true);
    expect(getEditorFormatState(editor).bulletList).toBe(true);
    editor.commands.selectAll();
    expect(setHighlightColor(editor, "#fef08a")).toBe(true);
    expect(getEditorFormatState(editor).highlight).toBe("#fef08a");
    expect(setLinkHref(editor, "example.com")).toBe(true);
    expect(getEditorFormatState(editor).link).toBe("https://example.com");
  });

  it("serializes variables, page breaks, and quote tables, then reloads equivalently", () => {
    editor = createEditor("<p>Intro</p>");
    insertVariable(editor, "client.firstName");
    editor.commands.insertContent({ type: "pageBreak" });
    insertQuoteTable(editor);
    const first = serializeStable(editor.getJSON() as EditorDoc);
    const clone = createEditor();
    clone.commands.setContent(JSON.parse(first) as EditorDoc);
    const second = serializeStable(clone.getJSON() as EditorDoc);
    expect(second).toBe(first);
    expect(first).toContain("variableToken");
    expect(first).toContain("client.firstName");
    expect(first).toContain("pageBreak");
    clone.destroy();
  });

  it("undo restores the previous document", () => {
    editor = createEditor();
    editor.commands.selectAll();
    toggleBold(editor);
    expect(getEditorFormatState(editor).bold).toBe(true);
    undo(editor);
    expect(getEditorFormatState(editor).bold).toBe(false);
  });
});
