/**
 * Commercial Quote/Invoice builder schema (v1).
 *
 * Authoritative payload lives in Document/Template `pricing_json` when
 * `schema === "commercial_v1"`. Legacy CPQ `PricingModel` remains unchanged
 * for historical Creator/quote-table documents.
 *
 * Money is stored as integer minor units (e.g. cents). Quantities use
 * fixed-point decimals with up to 4 fractional digits (scaled by 10_000).
 */

export const COMMERCIAL_SCHEMA = "commercial_v1" as const;

export type CommercialDocType = "quote" | "invoice";

export type MoneyMinor = number;
/** Quantity scaled by 10_000 (1.5 → 15000). */
export type QuantityScaled = number;

export type AdjustmentMode = "percent" | "fixed";

export type CommercialAdjustment = {
  enabled: boolean;
  mode: AdjustmentMode;
  /** Percent: 0–10000 = 0.00%–100.00% in basis points of a percent*100, or simpler: store as number 0-100 with 2dp as scaled*100 */
  /** For percent: value is percent * 100 (8.25% → 825). For fixed: minor units. */
  valueScaled: number;
};

export type CommercialLineItem = {
  id: string;
  description: string;
  quantityScaled: QuantityScaled;
  rateMinor: MoneyMinor;
  /** Optional catalog reference for future Products/Services linking. */
  catalogItemId?: string | null;
};

export type CommercialPartyText = {
  /** Raw multiline text; may include `[Sender.FullName]`-style tokens. */
  text: string;
  /** Keys the user deliberately overrode after a contact bind. */
  manualOverrides?: string[];
};

/** Default Sender box content for blank drafts and templates. */
export const DEFAULT_SENDER_TEXT =
  "[Sender.FullName]\n[Sender.CompanyName]\n[Sender.FullAddress]\n[Sender.Phone]";

/** Default Bill To box content for blank drafts and templates. */
export const DEFAULT_BILL_TO_TEXT = "[Recipient.CompanyName]";

export type CommercialLabels = {
  title: string;
  billTo: string;
  shipTo: string;
  item: string;
  quantity: string;
  rate: string;
  amount: string;
  notes: string;
  terms: string;
  tax: string;
  discount: string;
  shipping: string;
  subtotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  date: string;
  paymentTerms: string;
  dueDate: string;
  poNumber: string;
  documentNumber: string;
};

export type CommercialDocument = {
  schema: typeof COMMERCIAL_SCHEMA;
  type: CommercialDocType;
  /** Internal name shown in the app toolbar / document list. */
  internalName: string;
  documentNumber: string;
  currency: string;
  locale: string;
  issueDate: string | null;
  dueDate: string | null;
  paymentTerms: string;
  poNumber: string;
  logoAssetKey: string | null;
  sender: CommercialPartyText;
  billTo: CommercialPartyText;
  shipTo: CommercialPartyText;
  contactId: string | null;
  lineItems: CommercialLineItem[];
  discount: CommercialAdjustment;
  tax: CommercialAdjustment;
  shipping: CommercialAdjustment;
  /** Manual paid amount in minor units (invoices). Ledger payments take precedence when present. */
  amountPaidMinor: MoneyMinor;
  notes: string;
  terms: string;
  labels: CommercialLabels;
  /** Visual theme for title + line-item header bar. */
  theme: CommercialTheme;
  sourceTemplateId: string | null;
  sourceQuoteDocumentId: string | null;
  /** Relative due-date rule in days from issue date (templates). */
  dueDateOffsetDays: number | null;
};

export type CommercialTheme = {
  /** Line-item table header background (Item | Quantity | Rate | Amount). */
  tableHeaderBg: string;
  /** Google/system font id from FLOW_GOOGLE_FONTS. */
  titleFontId: string;
  titleColor: string;
  /** Title font size in px. */
  titleSizePx: number;
};

export const DEFAULT_COMMERCIAL_THEME: CommercialTheme = {
  tableHeaderBg: "#0f2744",
  titleFontId: "arial",
  titleColor: "#0f2744",
  titleSizePx: 44,
};

export type CommercialTotals = {
  subtotalMinor: MoneyMinor;
  discountMinor: MoneyMinor;
  discountedSubtotalMinor: MoneyMinor;
  taxMinor: MoneyMinor;
  shippingMinor: MoneyMinor;
  totalMinor: MoneyMinor;
  amountPaidMinor: MoneyMinor;
  balanceDueMinor: MoneyMinor;
  currency: string;
  precision: number;
};

export const DEFAULT_COMMERCIAL_LABELS: CommercialLabels = {
  title: "QUOTE",
  billTo: "Bill To",
  shipTo: "Ship To",
  item: "Item",
  quantity: "Quantity",
  rate: "Rate",
  amount: "Amount",
  notes: "Notes",
  terms: "Terms",
  tax: "Tax",
  discount: "Discount",
  shipping: "Shipping",
  subtotal: "Subtotal",
  total: "Total",
  amountPaid: "Amount Paid",
  balanceDue: "Balance Due",
  date: "Date",
  paymentTerms: "Payment Terms",
  dueDate: "Due Date",
  poNumber: "PO Number",
  documentNumber: "Quote Number",
};

export const QUANTITY_SCALE = 10_000;
export const PERCENT_SCALE = 100;

/** Currency minor-unit precision. Unknown → 2. */
export function currencyPrecision(currency: string): number {
  const code = currency.toUpperCase();
  if (code === "JPY" || code === "KRW" || code === "VND" || code === "CLP") {
    return 0;
  }
  if (code === "BHD" || code === "KWD" || code === "OMR" || code === "JOD") {
    return 3;
  }
  return 2;
}

export function isCommercialDocument(value: unknown): value is CommercialDocument {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { schema?: unknown }).schema === COMMERCIAL_SCHEMA,
  );
}

export function emptyAdjustment(): CommercialAdjustment {
  return { enabled: false, mode: "percent", valueScaled: 0 };
}

export function newLineItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBlankLineItem(): CommercialLineItem {
  return {
    id: newLineItemId(),
    description: "",
    quantityScaled: QUANTITY_SCALE,
    rateMinor: 0,
  };
}

export function createBlankCommercialDocument(
  type: CommercialDocType,
  options?: { currency?: string; documentNumber?: string; internalName?: string },
): CommercialDocument {
  const labels = { ...DEFAULT_COMMERCIAL_LABELS };
  labels.title = type === "invoice" ? "INVOICE" : "QUOTE";
  labels.documentNumber = type === "invoice" ? "Invoice Number" : "Quote Number";
  return {
    schema: COMMERCIAL_SCHEMA,
    type,
    internalName: options?.internalName ?? (type === "invoice" ? "Untitled Invoice" : "Untitled Quote"),
    documentNumber: options?.documentNumber ?? "",
    currency: (options?.currency ?? "USD").toUpperCase(),
    locale: "en-US",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: type === "invoice" ? null : null,
    paymentTerms: "",
    poNumber: "",
    logoAssetKey: null,
    sender: {
      text: DEFAULT_SENDER_TEXT,
    },
    billTo: { text: DEFAULT_BILL_TO_TEXT },
    shipTo: { text: "" },
    contactId: null,
    lineItems: [createBlankLineItem()],
    discount: emptyAdjustment(),
    tax: { enabled: true, mode: "percent", valueScaled: 0 },
    shipping: emptyAdjustment(),
    amountPaidMinor: 0,
    notes: "",
    terms: "",
    labels,
    theme: { ...DEFAULT_COMMERCIAL_THEME },
    sourceTemplateId: null,
    sourceQuoteDocumentId: null,
    dueDateOffsetDays: null,
  };
}
