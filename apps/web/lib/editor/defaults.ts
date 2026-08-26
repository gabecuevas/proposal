import type { EditorDoc, PricingModel, VariableRegistry } from "./types";

/** Blank sheet. Tiptap requires at least one block; the empty paragraph is a
 *  scaffold so hover can show the + insert control, not a starter element. */
export const defaultEditorDoc: EditorDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const defaultVariableRegistry: VariableRegistry = {
  "client.name": { required: true, label: "Client Name" },
  "client.company": { required: true, label: "Client Company" },
  "deal.value": { required: false, label: "Deal Value" },
};

export const defaultPricingModel: PricingModel = {
  currency: "USD",
  discountPercent: 0,
  taxPercent: 0,
  items: [],
};
