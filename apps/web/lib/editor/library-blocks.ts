import type { Editor } from "@tiptap/core";
import type { EditorDoc, EditorNode, JSONValue } from "./types";

export const LIBRARY_CATEGORIES = [
  { id: "text", label: "Text Block" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "table", label: "Tables" },
] as const;

export type LibraryCategoryId = (typeof LIBRARY_CATEGORIES)[number]["id"];

const TYPE_TO_CATEGORY: Record<string, LibraryCategoryId> = {
  textBox: "text",
  paragraph: "text",
  heading: "text",
  blockquote: "text",
  bulletList: "text",
  orderedList: "text",
  horizontalRule: "text",
  tableOfContents: "text",
  pageBreak: "text",
  contentBlockEmbed: "text",
  image: "image",
  fieldCanvas: "image",
  youtube: "video",
  table: "table",
  quoteTable: "table",
};

export function libraryCategoryForType(nodeType: string): LibraryCategoryId {
  return TYPE_TO_CATEGORY[nodeType] ?? "text";
}

export function resolveLibraryCategory(blockType: string): LibraryCategoryId {
  if (
    blockType === "text" ||
    blockType === "image" ||
    blockType === "video" ||
    blockType === "table"
  ) {
    return blockType;
  }
  return libraryCategoryForType(blockType);
}

export function libraryCategoryLabel(id: string): string {
  return LIBRARY_CATEGORIES.find((category) => category.id === id)?.label ?? "Text Block";
}

export function sliceNodeToDoc(node: EditorNode): EditorDoc {
  return { type: "doc", content: [node] };
}

export function sliceNodesToDoc(nodes: EditorNode[]): EditorDoc {
  return { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] };
}

export function defaultLibraryNameFromNodes(nodes: EditorNode[], fallback: string): string {
  for (const node of nodes) {
    const text = firstTextFromNode(node).replace(/\s+/g, " ").trim();
    if (text) {
      return text.slice(0, 60);
    }
  }
  return fallback;
}

export function firstTextFromNode(node: EditorNode | undefined): string {
  if (!node) {
    return "";
  }
  if (node.type === "text") {
    return node.text ?? "";
  }
  return (node.content ?? []).map(firstTextFromNode).join("");
}

export function defaultLibraryName(node: EditorNode): string {
  const text = firstTextFromNode(node).replace(/\s+/g, " ").trim();
  if (text) {
    return text.slice(0, 60);
  }
  return libraryCategoryLabel(libraryCategoryForType(node.type));
}

export function insertLibraryDoc(editor: Editor, doc: EditorDoc, insertPos?: number): boolean {
  const content = doc.content ?? [];
  if (content.length === 0) {
    return false;
  }
  const { $from } = editor.state.selection;
  const pos = insertPos ?? ($from.depth > 0 ? $from.after(1) : editor.state.doc.content.size);
  return editor.chain().focus().insertContentAt(pos, content).run();
}

export function duplicateNodeAt(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  return editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
}

export function deleteNodeAt(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  const from = pos;
  const to = pos + node.nodeSize;
  let contentCount = 0;
  editor.state.doc.forEach((child) => {
    if (child.type.name !== "fieldOverlay") {
      contentCount += 1;
    }
  });
  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch, state }) => {
      if (!dispatch) {
        return true;
      }
      if (contentCount <= 1) {
        const paragraph = state.schema.nodes.paragraph;
        if (!paragraph) {
          return false;
        }
        tr.replaceWith(from, to, paragraph.create());
      } else {
        tr.delete(from, to);
      }
      dispatch(tr);
      return true;
    })
    .run();
}

export function insertNodeAfter(editor: Editor, node: EditorNode, afterPos?: number): boolean {
  const { $from } = editor.state.selection;
  const pos = afterPos ?? ($from.depth > 0 ? $from.after(1) : editor.state.doc.content.size);
  return editor.chain().focus().insertContentAt(pos, node).run();
}

export function updateNodeAttrs(
  editor: Editor,
  pos: number,
  attrs: Record<string, JSONValue>,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  return editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (!dispatch) {
        return true;
      }
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
      dispatch(tr);
      return true;
    })
    .run();
}

export function replaceNodeContentWithText(editor: Editor, pos: number, text: string): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  const trimmed = text.trim();
  const inlineTypes = new Set(["paragraph", "heading"]);
  const next: EditorNode = inlineTypes.has(node.type.name)
    ? {
        type: node.type.name,
        attrs: node.attrs as EditorNode["attrs"],
        content: trimmed ? [{ type: "text", text: trimmed }] : [],
      }
    : {
        type: node.type.name,
        attrs: node.attrs as EditorNode["attrs"],
        content: trimmed
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({
            type: "paragraph" as const,
            content: [{ type: "text" as const, text: line }],
          })),
      };
  if (!next.content || next.content.length === 0) {
    next.content = inlineTypes.has(node.type.name) ? [] : [{ type: "paragraph" }];
  }
  return editor
    .chain()
    .focus()
    .deleteRange({ from: pos, to: pos + node.nodeSize })
    .insertContentAt(pos, next)
    .run();
}
