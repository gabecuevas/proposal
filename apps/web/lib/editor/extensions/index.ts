import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { ContentBlockEmbed } from "./content-block-embed";
import { PageBreak } from "./page-break";
import { QuoteTable } from "./quote-table";
import { SignerField } from "./signer-field";
import { VariableToken } from "./variable-token";

export const editorExtensions = [
  StarterKit.configure({
    bulletList: {},
    orderedList: {},
    blockquote: {},
  }),
  Image,
  PageBreak,
  VariableToken,
  ContentBlockEmbed,
  QuoteTable,
  SignerField,
];
