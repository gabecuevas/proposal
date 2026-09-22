/**
 * Flow Document TipTap extension set — continuous Google Docs–style body.
 * Excludes Creator TextBox, FieldOverlay, SignerField, PageFlow, and FieldCanvas.
 */
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { FlowTable, FlowTableCell, FlowTableHeader, FlowTableRow } from "@/lib/flow-document/table-extensions";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Node } from "@tiptap/core";
import { PaginationPlus, PAGE_SIZES, type PaginationPlusOptions } from "tiptap-pagination-plus";
import { FillBlank } from "@/lib/editor/extensions/fill-blank";
import { FontSize } from "@/lib/editor/extensions/font-size";
import { Indent } from "@/lib/editor/extensions/indent";
import { LineHeight } from "@/lib/editor/extensions/line-height";
import { VariableToken } from "@/lib/editor/extensions/variable-token";
import { FLOW_DEFAULT_FONT } from "@/lib/flow-document/google-fonts";

/** Explicit manual page break — atom block, continuous document. */
export const FlowPageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-flow-page-break]" }, { tag: "div[data-page-break]" }];
  },
  renderHTML() {
    return [
      "div",
      {
        "data-flow-page-break": "true",
        "data-page-break": "true",
        class: "flow-page-break",
        "data-node-type": "pageBreak",
      },
    ];
  },
});

export type FlowPaperId = "letter" | "a4" | "legal";

export const FLOW_PAPER_PRESETS: Record<
  FlowPaperId,
  { label: string; size: (typeof PAGE_SIZES)[keyof typeof PAGE_SIZES] }
> = {
  letter: { label: "US Letter", size: PAGE_SIZES.LETTER },
  a4: { label: "A4", size: PAGE_SIZES.A4 },
  legal: { label: "US Legal", size: PAGE_SIZES.LEGAL },
};

export function flowPaginationOptions(
  paper: FlowPaperId = "letter",
  overrides: Partial<PaginationPlusOptions> = {},
): Partial<PaginationPlusOptions> {
  const preset = FLOW_PAPER_PRESETS[paper].size;
  return {
    ...preset,
    // Docs-like default Letter margins: 1" all sides (overridden by saved page margins).
    marginTop: 96,
    marginBottom: 96,
    marginLeft: 96,
    marginRight: 96,
    pageGap: 32,
    pageGapBorderSize: 1,
    pageGapBorderColor: "#d4d4d8",
    pageBreakBackground: "#f4f4f5",
    contentMarginTop: 8,
    contentMarginBottom: 8,
    // Clean pages until the user adds header/footer content.
    headerLeft: "",
    headerRight: "",
    footerLeft: "",
    footerRight: "",
    ...overrides,
  };
}

export function createFlowDocumentExtensions(options?: {
  paper?: FlowPaperId;
  pagination?: boolean;
  paginationOverrides?: Partial<PaginationPlusOptions>;
}) {
  const paper = options?.paper ?? "letter";
  const withPagination = options?.pagination !== false;

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Underline,
    FillBlank,
    TextStyle,
    FontFamily.configure({ types: ["textStyle"] }),
    Color.configure({ types: ["textStyle"] }),
    FontSize,
    Highlight.configure({ multicolor: true }),
    LineHeight,
    Indent,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    Image.configure({ inline: true, allowBase64: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList.configure({
      HTMLAttributes: { class: "flow-task-list" },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: "flow-task-item" },
    }),
    FlowTable,
    FlowTableRow,
    FlowTableHeader,
    FlowTableCell,
    FlowPageBreak,
    VariableToken,
    ...(withPagination
      ? [
          PaginationPlus.configure(
            flowPaginationOptions(paper, options?.paginationOverrides) as PaginationPlusOptions,
          ),
        ]
      : []),
  ];
}

export const FLOW_EDITOR_DEFAULT_ATTRIBUTES = {
  class: "flow-document-editor focus:outline-none",
  "data-flow-document": "true",
  spellcheck: "true",
  style: `font-family: ${FLOW_DEFAULT_FONT.family}; font-size: 11pt; line-height: 1.5;`,
};
