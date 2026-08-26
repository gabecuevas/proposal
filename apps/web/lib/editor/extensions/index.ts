import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import StarterKit from "@tiptap/starter-kit";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FieldCanvasView } from "@/components/editor/field-canvas-view";
import { FieldOverlayView } from "@/components/editor/field-overlay-view";
import { ResizableImageView } from "@/components/editor/resizable-image-view";
import { SignerFieldView } from "@/components/editor/signer-field-view";
import { TableOfContentsView } from "@/components/editor/table-of-contents-view";
import { BlockMeta } from "./block-meta";
import { ContentBlockEmbed } from "./content-block-embed";
import { CreatorDocument } from "./creator-document";
import { FieldCanvas } from "./field-canvas";
import { FieldOverlay } from "./field-overlay";
import { FlowGaps } from "./flow-gaps";
import { FontSize } from "./font-size";
import { Indent } from "./indent";
import { LineHeight } from "./line-height";
import { PageBreak } from "./page-break";
import { PageFlow } from "./page-flow";
import { QuoteTable } from "./quote-table";
import { ResizableImage } from "./resizable-image";
import { SignerField } from "./signer-field";
import { TableOfContents } from "./table-of-contents";
import { TextBox } from "./text-box";
import { VariableToken } from "./variable-token";
import { QuoteTableView } from "@/components/editor/quote-table-view";

const FieldCanvasWithView = FieldCanvas.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FieldCanvasView);
  },
});

const FieldOverlayWithView = FieldOverlay.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FieldOverlayView);
  },
});

const SignerFieldWithView = SignerField.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SignerFieldView);
  },
});

const ResizableImageWithView = ResizableImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

const QuoteTableWithView = QuoteTable.extend({
  addNodeView() {
    return ReactNodeViewRenderer(QuoteTableView);
  },
});

const TableOfContentsWithView = TableOfContents.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView);
  },
});

export const editorExtensions = [
  CreatorDocument,
  StarterKit.configure({
    document: false,
    bulletList: {},
    orderedList: {},
    blockquote: {},
  }),
  Underline,
  TextStyle,
  FontFamily.configure({ types: ["textStyle"] }),
  Color.configure({ types: ["textStyle"] }),
  FontSize,
  Highlight.configure({ multicolor: true }),
  LineHeight,
  Indent,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener" } }),
  Placeholder.configure({
    placeholder: ({ node }) => (node.type.name === "heading" ? "Document title" : ""),
  }),
  FlowGaps,
  Table.configure({ resizable: true, lastColumnResizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Youtube.configure({ controls: true, nocookie: true, modestBranding: true, width: 640, height: 360 }),
  TextBox,
  ResizableImageWithView,
  TableOfContentsWithView,
  PageBreak,
  PageFlow,
  VariableToken,
  ContentBlockEmbed,
  BlockMeta,
  QuoteTableWithView,
  SignerFieldWithView,
  FieldCanvasWithView,
  FieldOverlayWithView,
];
