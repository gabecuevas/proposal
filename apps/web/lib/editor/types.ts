export const CURRENT_DOC_VERSION = 1;

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

export type EditorNode = {
  type: string;
  attrs?: Record<string, JSONValue>;
  content?: EditorNode[];
  marks?: { type: string; attrs?: Record<string, JSONValue> }[];
  text?: string;
};

export type EditorDoc = {
  type: "doc";
  content: EditorNode[];
};

export type VariableRegistry = Record<string, { required: boolean; label?: string }>;

export type VariableContext = Record<string, JSONValue>;

export type QuoteLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  optional?: boolean;
  selected?: boolean;
  recurring?: { interval: "month" | "year"; periods?: number };
};

export type PricingModel = {
  currency: string;
  discountPercent?: number;
  taxPercent?: number;
  items: QuoteLineItem[];
};

export type QuoteTotals = {
  oneTimeSubtotal: number;
  recurringMonthlySubtotal: number;
  recurringYearlySubtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalDueNow: number;
};

export type SignerFieldValue = {
  fieldId: string;
  recipientId: string;
  type: "signature" | "initial" | "date" | "text" | "checkbox";
  required: boolean;
  value: JSONValue;
};
