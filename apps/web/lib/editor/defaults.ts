import type { EditorDoc, PricingModel, VariableRegistry } from "./types";

export const defaultEditorDoc: EditorDoc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Proposal Title" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Start writing your proposal..." }],
    },
  ],
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
