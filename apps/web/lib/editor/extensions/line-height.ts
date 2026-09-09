import { Extension } from "@tiptap/core";
import { mapTextBlocks } from "./indent";

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
        ({ state, tr, dispatch }) =>
          mapTextBlocks(state, tr, dispatch, () => ({ lineHeight })),
      unsetLineHeight:
        () =>
        ({ state, tr, dispatch }) =>
          mapTextBlocks(state, tr, dispatch, () => ({ lineHeight: null })),
    };
  },
});
