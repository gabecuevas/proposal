import { Node } from "@tiptap/core";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSizeId } from "../page-geometry";
import {
  parsePageBackgrounds,
  patchPageBackground,
  type PageBackground,
} from "../page-backgrounds";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    creatorDocument: {
      setPageSize: (pageSize: PageSizeId) => ReturnType;
      setPageBackground: (pageIndex: number, patch: Partial<PageBackground>) => ReturnType;
      clearPageBackground: (pageIndex: number) => ReturnType;
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
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-doc-title"),
        renderHTML: (attributes) =>
          attributes.title ? { "data-doc-title": String(attributes.title) } : {},
      },
      pageBackgrounds: {
        default: null,
        parseHTML: (element) => parsePageBackgrounds(element.getAttribute("data-page-backgrounds")),
        renderHTML: (attributes) => {
          const parsed = parsePageBackgrounds(attributes.pageBackgrounds);
          return Object.keys(parsed).length
            ? { "data-page-backgrounds": JSON.stringify(parsed) }
            : {};
        },
      },
    };
  },

  addCommands() {
    return {
      setPageSize:
        (pageSize) =>
        ({ tr, dispatch }) => {
          tr.setDocAttribute("pageSize", parsePageSize(pageSize));
          dispatch?.(tr);
          return true;
        },
      setPageBackground:
        (pageIndex, patch) =>
        ({ tr, editor, dispatch }) => {
          const next = patchPageBackground(
            parsePageBackgrounds(editor.state.doc.attrs.pageBackgrounds),
            pageIndex,
            patch,
          );
          tr.setDocAttribute("pageBackgrounds", next);
          dispatch?.(tr);
          return true;
        },
      clearPageBackground:
        (pageIndex) =>
        ({ tr, editor, dispatch }) => {
          const next = patchPageBackground(
            parsePageBackgrounds(editor.state.doc.attrs.pageBackgrounds),
            pageIndex,
            { color: null, imageKey: null },
          );
          tr.setDocAttribute("pageBackgrounds", next);
          dispatch?.(tr);
          return true;
        },
    };
  },
});
