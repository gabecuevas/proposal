import {
  COMMERCIAL_SCHEMA,
  createBlankCommercialDocument,
  createBlankLineItem,
  DEFAULT_BILL_TO_TEXT,
  DEFAULT_COMMERCIAL_THEME,
  DEFAULT_SENDER_TEXT,
  emptyAdjustment,
  isCommercialDocument,
  type CommercialAdjustment,
  type CommercialDocType,
  type CommercialDocument,
  type CommercialLabels,
  type CommercialLineItem,
  type CommercialPartyText,
  type CommercialTheme,
  DEFAULT_COMMERCIAL_LABELS,
} from "./schema";
import { extractCommercialTokens } from "./variables";
import { FLOW_GOOGLE_FONTS } from "@/lib/flow-document/google-fonts";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return typeof value === "string" ? value : null;
}

function parseTheme(value: unknown): CommercialTheme {
  const obj = asObject(value);
  const fontIds = new Set(FLOW_GOOGLE_FONTS.map((f) => f.id));
  const titleFontId = asString(obj?.titleFontId, DEFAULT_COMMERCIAL_THEME.titleFontId);
  const titleSizePx = Math.trunc(asNumber(obj?.titleSizePx, DEFAULT_COMMERCIAL_THEME.titleSizePx));
  return {
    tableHeaderBg: asString(obj?.tableHeaderBg, DEFAULT_COMMERCIAL_THEME.tableHeaderBg) || DEFAULT_COMMERCIAL_THEME.tableHeaderBg,
    titleFontId: fontIds.has(titleFontId) ? titleFontId : DEFAULT_COMMERCIAL_THEME.titleFontId,
    titleColor: asString(obj?.titleColor, DEFAULT_COMMERCIAL_THEME.titleColor) || DEFAULT_COMMERCIAL_THEME.titleColor,
    titleSizePx: Math.max(20, Math.min(96, titleSizePx || DEFAULT_COMMERCIAL_THEME.titleSizePx)),
  };
}

function parseParty(value: unknown, fallbackText: string): CommercialPartyText {
  const obj = asObject(value);
  if (!obj) {
    return { text: fallbackText };
  }
  return {
    text: asString(obj.text, fallbackText),
    manualOverrides: Array.isArray(obj.manualOverrides)
      ? obj.manualOverrides.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function parseAdjustment(value: unknown, fallback: CommercialAdjustment): CommercialAdjustment {
  const obj = asObject(value);
  if (!obj) {
    return { ...fallback };
  }
  const mode = obj.mode === "fixed" ? "fixed" : "percent";
  return {
    enabled: Boolean(obj.enabled),
    mode,
    valueScaled: Math.trunc(asNumber(obj.valueScaled, 0)),
  };
}

function parseLineItem(value: unknown): CommercialLineItem | null {
  const obj = asObject(value);
  if (!obj || typeof obj.id !== "string" || !obj.id) {
    return null;
  }
  return {
    id: obj.id,
    description: asString(obj.description),
    quantityScaled: Math.trunc(asNumber(obj.quantityScaled, 10_000)),
    rateMinor: Math.trunc(asNumber(obj.rateMinor, 0)),
    catalogItemId: asNullableString(obj.catalogItemId),
  };
}

function parseLabels(value: unknown, type: CommercialDocType): CommercialLabels {
  const base = {
    ...DEFAULT_COMMERCIAL_LABELS,
    title: type === "invoice" ? "INVOICE" : "QUOTE",
    documentNumber: type === "invoice" ? "Invoice Number" : "Quote Number",
  };
  const obj = asObject(value);
  if (!obj) {
    return base;
  }
  const next = { ...base };
  for (const key of Object.keys(base) as Array<keyof CommercialLabels>) {
    if (typeof obj[key] === "string" && obj[key]) {
      next[key] = obj[key] as string;
    }
  }
  return next;
}

export function parseCommercialDocument(
  value: unknown,
  _fallbackType: CommercialDocType = "quote",
): CommercialDocument | null {
  void _fallbackType;
  const obj = asObject(value);
  if (!obj || obj.schema !== COMMERCIAL_SCHEMA) {
    return null;
  }
  const type: CommercialDocType = obj.type === "invoice" ? "invoice" : "quote";
  const lineItems = Array.isArray(obj.lineItems)
    ? obj.lineItems.map(parseLineItem).filter((item): item is CommercialLineItem => Boolean(item))
    : [];
  return {
    schema: COMMERCIAL_SCHEMA,
    type,
    internalName: asString(obj.internalName, type === "invoice" ? "Untitled Invoice" : "Untitled Quote"),
    documentNumber: asString(obj.documentNumber),
    currency: asString(obj.currency, "USD").toUpperCase() || "USD",
    locale: asString(obj.locale, "en-US") || "en-US",
    issueDate: asNullableString(obj.issueDate),
    dueDate: asNullableString(obj.dueDate),
    paymentTerms: asString(obj.paymentTerms),
    poNumber: asString(obj.poNumber),
    logoAssetKey: asNullableString(obj.logoAssetKey),
    sender: parseParty(obj.sender, DEFAULT_SENDER_TEXT),
    billTo: parseParty(obj.billTo, DEFAULT_BILL_TO_TEXT),
    shipTo: parseParty(obj.shipTo, ""),
    contactId: asNullableString(obj.contactId),
    lineItems: lineItems.length > 0 ? lineItems : [createBlankLineItem()],
    discount: parseAdjustment(obj.discount, emptyAdjustment()),
    tax: parseAdjustment(obj.tax, { enabled: true, mode: "percent", valueScaled: 0 }),
    shipping: parseAdjustment(obj.shipping, emptyAdjustment()),
    amountPaidMinor: Math.max(0, Math.trunc(asNumber(obj.amountPaidMinor, 0))),
    notes: asString(obj.notes),
    terms: asString(obj.terms),
    labels: parseLabels(obj.labels, type),
    theme: parseTheme(obj.theme),
    sourceTemplateId: asNullableString(obj.sourceTemplateId),
    sourceQuoteDocumentId: asNullableString(obj.sourceQuoteDocumentId),
    dueDateOffsetDays:
      obj.dueDateOffsetDays == null ? null : Math.trunc(asNumber(obj.dueDateOffsetDays, 0)),
  };
}

export function ensureCommercialDocument(
  value: unknown,
  type: CommercialDocType,
): CommercialDocument {
  return parseCommercialDocument(value, type) ?? createBlankCommercialDocument(type);
}

export function commercialFromUnknownPricing(
  pricing: unknown,
  type: CommercialDocType,
): CommercialDocument {
  if (isCommercialDocument(pricing)) {
    return parseCommercialDocument(pricing, type) ?? createBlankCommercialDocument(type);
  }
  return createBlankCommercialDocument(type);
}

/**
 * Prefer variable-token layouts for templates. Plain filled text (no tokens)
 * falls back to the standard Sender / Bill To defaults so every template
 * starts with auto-fill placeholders. Custom token layouts are kept so users
 * can Save as Template after editing variables.
 */
function templatePartyOrDefault(text: string, fallback: string): CommercialPartyText {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: fallback };
  }
  if (extractCommercialTokens(trimmed).length > 0) {
    return { text };
  }
  return { text: fallback };
}

/** Reset customer-specific fields when saving a template. */
export function toCommercialTemplatePayload(doc: CommercialDocument): CommercialDocument {
  return {
    ...doc,
    documentNumber: "",
    issueDate: null,
    dueDate: null,
    poNumber: "",
    amountPaidMinor: 0,
    contactId: null,
    sender: templatePartyOrDefault(doc.sender.text, DEFAULT_SENDER_TEXT),
    billTo: templatePartyOrDefault(doc.billTo.text, DEFAULT_BILL_TO_TEXT),
    shipTo: { text: "" },
    sourceQuoteDocumentId: null,
    lineItems: doc.lineItems.map((item) => ({
      ...item,
      id: createBlankLineItem().id,
    })),
  };
}

/** Instantiate a draft from a template payload. */
export function instantiateCommercialFromTemplate(
  template: CommercialDocument,
  options: {
    type: CommercialDocType;
    documentNumber: string;
    issueDate: string;
    dueDate?: string | null;
    internalName?: string;
    sourceTemplateId: string;
  },
): CommercialDocument {
  const dueDate =
    options.dueDate ??
    (template.dueDateOffsetDays != null
      ? addDaysIso(options.issueDate, template.dueDateOffsetDays)
      : null);
  return {
    ...template,
    type: options.type,
    labels: {
      ...template.labels,
      title: options.type === "invoice" ? "INVOICE" : template.labels.title || "QUOTE",
      documentNumber:
        options.type === "invoice"
          ? "Invoice Number"
          : template.labels.documentNumber || "Quote Number",
    },
    internalName:
      options.internalName ??
      (options.type === "invoice" ? "Untitled Invoice" : "Untitled Quote"),
    documentNumber: options.documentNumber,
    issueDate: options.issueDate,
    dueDate: options.type === "invoice" ? dueDate : null,
    poNumber: "",
    amountPaidMinor: 0,
    contactId: null,
    sender: templatePartyOrDefault(template.sender?.text ?? "", DEFAULT_SENDER_TEXT),
    billTo: templatePartyOrDefault(template.billTo?.text ?? "", DEFAULT_BILL_TO_TEXT),
    shipTo: { text: "" },
    sourceTemplateId: options.sourceTemplateId,
    sourceQuoteDocumentId: null,
    lineItems: template.lineItems.map((item) => ({
      ...item,
      id: createBlankLineItem().id,
    })),
  };
}

export function convertQuoteToInvoicePayload(
  quote: CommercialDocument,
  options: { documentNumber: string; issueDate: string; dueDate?: string | null; sourceQuoteDocumentId: string },
): CommercialDocument {
  return {
    ...quote,
    type: "invoice",
    labels: { ...quote.labels, title: "INVOICE", documentNumber: "Invoice Number" },
    internalName: quote.internalName.replace(/quote/i, "Invoice") || "Untitled Invoice",
    documentNumber: options.documentNumber,
    issueDate: options.issueDate,
    dueDate: options.dueDate ?? null,
    amountPaidMinor: 0,
    sourceQuoteDocumentId: options.sourceQuoteDocumentId,
    lineItems: quote.lineItems.map((item) => ({ ...item, id: createBlankLineItem().id })),
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
