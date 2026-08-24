import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorDoc, EditorNode } from "../types";

export type TocEntry = {
  id: string;
  level: number;
  text: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      title: { default: "Table of contents" },
      maxLevel: { default: 3 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="tableOfContents"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "tableOfContents",
        class: "creator-toc",
      }),
    ];
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

function headingText(node: EditorNode | ProseMirrorNode): string {
  if ("textContent" in node && typeof node.textContent === "string") {
    return node.textContent;
  }
  const editorNode = node as EditorNode;
  if (editorNode.type === "text") {
    return editorNode.text ?? "";
  }
  return (editorNode.content ?? []).map(headingText).join("");
}

/** Slug used both as the anchor id in rendered HTML and the scroll target. */
export function headingSlug(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `heading-${index}-${slug}` : `heading-${index}`;
}

export function collectHeadings(doc: EditorDoc, maxLevel = 3): TocEntry[] {
  const entries: TocEntry[] = [];
  let index = 0;

  const walk = (nodes: EditorNode[]) => {
    for (const node of nodes) {
      if (node.type === "heading") {
        const level = Number(node.attrs?.level ?? 1);
        const text = headingText(node).trim();
        if (level <= maxLevel && text) {
          entries.push({ id: headingSlug(text, index), level, text });
        }
        index += 1;
      }
      if (node.content) {
        walk(node.content);
      }
    }
  };

  walk(doc.content ?? []);
  return entries;
}
