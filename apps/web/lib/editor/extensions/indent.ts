import { Extension } from "@tiptap/core";
import { INDENT_MAX } from "../commands/format-presets";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

function nextIndent(current: unknown, delta: number): number {
  const value = Number(current ?? 0);
  const indent = Number.isFinite(value) ? value : 0;
  return Math.min(INDENT_MAX, Math.max(0, indent + delta));
}

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-indent");
              const value = raw ? Number(raw) : 0;
              return Number.isFinite(value) ? Math.min(INDENT_MAX, Math.max(0, value)) : 0;
            },
            renderHTML: (attributes) =>
              attributes.indent
                ? { "data-indent": String(attributes.indent) }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ commands, editor }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const indent = nextIndent(editor.getAttributes(type).indent, 1);
          return commands.updateAttributes(type, { indent });
        },
      decreaseIndent:
        () =>
        ({ commands, editor }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const indent = nextIndent(editor.getAttributes(type).indent, -1);
          return commands.updateAttributes(type, { indent });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) {
          return false;
        }
        return this.editor.commands.increaseIndent();
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) {
          return false;
        }
        return this.editor.commands.decreaseIndent();
      },
    };
  },
});
