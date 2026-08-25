import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || element.getAttribute("data-line-height") || null,
            renderHTML: (attributes) =>
              attributes.lineHeight
                ? { "data-line-height": attributes.lineHeight, style: `line-height: ${attributes.lineHeight}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands, editor }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          return commands.updateAttributes(type, { lineHeight });
        },
      unsetLineHeight:
        () =>
        ({ commands, editor }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          return commands.resetAttributes(type, "lineHeight");
        },
    };
  },
});
