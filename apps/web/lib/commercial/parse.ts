import {
  COMMERCIAL_SCHEMA,
  createBlankCommercialDocument,
  createBlankLineItem,
  emptyAdjustment,
  isCommercialDocument,
  type CommercialAdjustment,
  type CommercialDocType,
  type CommercialDocument,
  type CommercialLabels,
  type CommercialLineItem,
  type CommercialPartyText,
  DEFAULT_COMMERCIAL_LABELS,
} from "./schema";

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
    sender: parseParty(obj.sender, "[Sender.FullName]\n[Sender.CompanyName]\n[Sender.FullAddress]\n[Sender.Phone]"),
    billTo: parseParty(obj.billTo, "[Recipient.CompanyName]"),
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
    billTo: { text: "[Recipient.CompanyName]" },
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
    billTo: { text: "[Recipient.CompanyName]" },
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
    labels: { ...quote.labels, title: "INVOICE" },
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
