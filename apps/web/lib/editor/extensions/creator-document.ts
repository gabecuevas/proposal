import { Node } from "@tiptap/core";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSizeId } from "../page-geometry";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    creatorDocument: {
      setPageSize: (pageSize: PageSizeId) => ReturnType;
    };
  }
}

/**
 * Top-level document node with a persisted page size. StarterKit's `document`
 * is disabled so this one can carry attributes.
 */
export const CreatorDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",

  addAttributes() {
    return {
      pageSize: {
        default: DEFAULT_PAGE_SIZE,
        parseHTML: (element) => parsePageSize(element.getAttribute("data-page-size")),
        renderHTML: (attributes) => ({
          "data-page-size": parsePageSize(attributes.pageSize),
        }),
      },
    };
  },

  addCommands() {
    return {
      setPageSize:
        (pageSize) =>
        ({ commands }) =>
          commands.updateAttributes("doc", { pageSize: parsePageSize(pageSize) }),
    };
  },
});
