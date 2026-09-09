import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  insertDivider,
  insertHeading,
  insertPageBreak,
  insertQuoteTable,
  insertTable,
  insertTextBlock,
  insertVariable,
} from "../insert-elements";
import type { SignerFieldEditorType } from "../signer-field-attrs";
import { insertSignerFieldBlock } from "../insert-signer-field";
import type { BlockStyleId } from "./format-presets";

export type { BlockStyleId };

/** Last caret inside a paragraph/heading so toolbar clicks can recover after blur. */
let lastTextblockPos: number | null = null;

export type EditorFormatState = {
  blockStyle: BlockStyleId;
  fontFamily: string;
  fontSize: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  highlight: string;
  link: string;
  align: "left" | "center" | "right" | "justify" | "";
  bulletList: boolean;
  orderedList: boolean;
  lineHeight: string;
  indent: number;
  canUndo: boolean;
  canRedo: boolean;
  inTable: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function rememberTextCaret(editor: Editor): void {
  const { $from } = editor.state.selection;
  if ($from.parent.isTextblock) {
    lastTextblockPos = $from.pos;
  }
}

function restoreTextCaret(editor: Editor): boolean {
  if (editor.state.selection.$from.parent.isTextblock) {
    return true;
  }
  if (lastTextblockPos == null) {
    return false;
  }
  const max = editor.state.doc.content.size;
  const pos = Math.min(Math.max(1, lastTextblockPos), Math.max(1, max));
  const $pos = editor.state.doc.resolve(pos);
  if (!$pos.parent.isTextblock) {
    return false;
  }
  editor.commands.setTextSelection(pos);
  return true;
}

/** Move into an isolating block (text box) so heading/list commands can run. */
function focusInsideSelectedBlock(editor: Editor): void {
  rememberTextCaret(editor);
  const { selection, doc } = editor.state;
  if (selection instanceof NodeSelection && selection.node.childCount > 0 && !selection.node.isAtom) {
    editor.commands.setTextSelection(selection.from + 1);
    rememberTextCaret(editor);
    return;
  }
  if (selection.$from.depth > 0 && selection.$from.parent.isTextblock) {
    return;
  }

  let innerPos: number | null = null;
  doc.nodesBetween(selection.from, Math.max(selection.to, selection.from + 1), (node, pos) => {
    if (innerPos !== null) {
      return false;
    }
    if (node.isTextblock) {
      innerPos = pos + 1;
      return false;
    }
    return true;
  });
  if (innerPos !== null) {
    editor.commands.setTextSelection(innerPos);
    rememberTextCaret(editor);
    return;
  }
  restoreTextCaret(editor);
}

/**
 * Font/size are marks. A collapsed caret only sets "next typed character" marks,
 * which looks like the toolbar did nothing — expand to the current block first.
 */
function chainOnCurrentText(editor: Editor) {
  focusInsideSelectedBlock(editor);
  const { empty, $from } = editor.state.selection;
  const chain = editor.chain().focus();
  if (empty && $from.parent.isTextblock && $from.start() < $from.end()) {
    chain.setTextSelection({ from: $from.start(), to: $from.end() });
  }
  return chain;
}

function runListCommand(editor: Editor, command: "toggleBulletList" | "toggleOrderedList"): boolean {
  focusInsideSelectedBlock(editor);
  const chain = editor.chain().focus();
  // listItem content is `paragraph block*`, so a heading cannot wrap until it is a paragraph.
  if (editor.isActive("heading")) {
    chain.setParagraph();
  }
  if (command === "toggleBulletList") {
    return chain.toggleBulletList().run();
  }
  return chain.toggleOrderedList().run();
}

export function getBlockStyle(editor: Editor): BlockStyleId {
  if (editor.isActive("heading", { level: 1 })) {
    return "h1";
  }
  if (editor.isActive("heading", { level: 2 })) {
    return "h2";
  }
  if (editor.isActive("heading", { level: 3 })) {
    return "h3";
  }
  return "paragraph";
}

export function getEditorFormatState(editor: Editor): EditorFormatState {
  rememberTextCaret(editor);
  const textStyle = editor.getAttributes("textStyle");
  const highlight = editor.getAttributes("highlight");
  const link = editor.getAttributes("link");
  const blockType = editor.isActive("heading") ? "heading" : "paragraph";
  const blockAttrs = editor.getAttributes(blockType);
  let align: EditorFormatState["align"] = "";
  if (editor.isActive({ textAlign: "center" })) {
    align = "center";
  } else if (editor.isActive({ textAlign: "right" })) {
    align = "right";
  } else if (editor.isActive({ textAlign: "justify" })) {
    align = "justify";
  } else if (editor.isActive({ textAlign: "left" }) || editor.isActive("paragraph") || editor.isActive("heading")) {
    align = "left";
  }

  return {
    blockStyle: getBlockStyle(editor),
    fontFamily: asString(textStyle.fontFamily),
    fontSize: asString(textStyle.fontSize),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    color: asString(textStyle.color),
    highlight: asString(highlight.color) || (editor.isActive("highlight") ? "#fef08a" : ""),
    link: asString(link.href),
    align,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    lineHeight: asString(blockAttrs.lineHeight),
    indent: Number(blockAttrs.indent ?? 0) || 0,
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    inTable: editor.isActive("table"),
  };
}

export function setBlockStyle(editor: Editor, style: BlockStyleId): boolean {
  focusInsideSelectedBlock(editor);
  if (style === "paragraph") {
    if (getBlockStyle(editor) === "paragraph") {
      return true;
    }
    return editor.chain().focus().setParagraph().run();
  }
  const level = Number(style.slice(1)) as 1 | 2 | 3;
  if (getBlockStyle(editor) === style) {
    return true;
  }
  return editor.chain().focus().setHeading({ level }).run();
}

export function setFontFamily(editor: Editor, fontFamily: string): boolean {
  const chain = chainOnCurrentText(editor);
  if (!fontFamily) {
    return chain.unsetFontFamily().run();
  }
  return chain.setFontFamily(fontFamily).run();
}

export function setFontSize(editor: Editor, fontSize: string): boolean {
  const chain = chainOnCurrentText(editor);
  if (!fontSize) {
    return chain.unsetFontSize().run();
  }
  return chain.setFontSize(fontSize).run();
}

export function toggleBold(editor: Editor): boolean {
  return editor.chain().focus().toggleBold().run();
}

export function toggleItalic(editor: Editor): boolean {
  return editor.chain().focus().toggleItalic().run();
}

export function toggleUnderline(editor: Editor): boolean {
  return editor.chain().focus().toggleUnderline().run();
}

export function toggleStrike(editor: Editor): boolean {
  return editor.chain().focus().toggleStrike().run();
}

export function setTextColor(editor: Editor, color: string): boolean {
  if (!color) {
    return editor.chain().focus().unsetColor().run();
  }
  return editor.chain().focus().setColor(color).run();
}

export function setHighlightColor(editor: Editor, color: string): boolean {
  if (!color) {
    return editor.chain().focus().unsetHighlight().run();
  }
  return editor.chain().focus().setHighlight({ color }).run();
}

export function setLinkHref(editor: Editor, href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) {
    return editor.chain().focus().unsetLink().run();
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
}

export function unsetLink(editor: Editor): boolean {
  return editor.chain().focus().unsetLink().run();
}

export function setAlignment(editor: Editor, align: "left" | "center" | "right" | "justify"): boolean {
  return editor.chain().focus().setTextAlign(align).run();
}

export function toggleBulletList(editor: Editor): boolean {
  return runListCommand(editor, "toggleBulletList");
}

export function toggleOrderedList(editor: Editor): boolean {
  return runListCommand(editor, "toggleOrderedList");
}

export function indentSelection(editor: Editor): boolean {
  focusInsideSelectedBlock(editor);
  if (editor.isActive("listItem") && editor.can().sinkListItem("listItem")) {
    return editor.chain().focus().sinkListItem("listItem").run();
  }
  return editor.chain().focus().increaseIndent().run();
}

export function outdentSelection(editor: Editor): boolean {
  focusInsideSelectedBlock(editor);
  if (editor.isActive("listItem") && editor.can().liftListItem("listItem")) {
    return editor.chain().focus().liftListItem("listItem").run();
  }
  return editor.chain().focus().decreaseIndent().run();
}

export function setLineHeight(editor: Editor, lineHeight: string): boolean {
  focusInsideSelectedBlock(editor);
  if (!lineHeight) {
    return editor.chain().focus().unsetLineHeight().run();
  }
  return editor.chain().focus().setLineHeight(lineHeight).run();
}

export function clearFormatting(editor: Editor): boolean {
  return editor.chain().focus().unsetAllMarks().clearNodes().run();
}

export function undo(editor: Editor): boolean {
  return editor.chain().focus().undo().run();
}

export function redo(editor: Editor): boolean {
  return editor.chain().focus().redo().run();
}

export function selectAll(editor: Editor): boolean {
  return editor.chain().focus().selectAll().run();
}

export function execClipboard(editor: Editor, action: "cut" | "copy" | "paste"): boolean {
  editor.chain().focus().run();
  return document.execCommand(action);
}

/**
 * Edit-menu clipboard. Keyboard Cmd+V still uses Tiptap's paste pipeline
 * (`transformPastedHTML`). This path prefers the Clipboard API so Chrome is
 * not asked to run the deprecated `execCommand`.
 */
export async function runClipboardAction(editor: Editor, action: "cut" | "copy" | "paste"): Promise<boolean> {
  editor.chain().focus().run();
  const { from, to } = editor.state.selection;

  if (action === "copy" || action === "cut") {
    const text = editor.state.doc.textBetween(from, to, "\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return document.execCommand(action);
    }
    if (action === "cut") {
      return editor.chain().focus().deleteSelection().run();
    }
    return true;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      return false;
    }
    return editor.chain().focus().insertContent(text).run();
  } catch {
    return document.execCommand("paste");
  }
}

export function insertText(editor: Editor): void {
  insertTextBlock(editor);
}

export function insertHeadingBlock(editor: Editor, level: 1 | 2 | 3 = 2): void {
  insertHeading(editor, level);
}

export function insertHorizontalRule(editor: Editor): void {
  insertDivider(editor);
}

export function insertPageBreakBlock(editor: Editor): void {
  insertPageBreak(editor);
}

export function insertTableBlock(editor: Editor, rows = 3, cols = 3): void {
  insertTable(editor, rows, cols);
}

export function insertPricingTable(editor: Editor, tableId = "default"): void {
  insertQuoteTable(editor, tableId);
}

export function insertVariableToken(editor: Editor, key: string): void {
  insertVariable(editor, key);
}

export function insertSigningField(
  editor: Editor,
  input: { recipientId: string; type: SignerFieldEditorType },
): boolean {
  return insertSignerFieldBlock(editor, input);
}
