import type { JSONValue } from "./types";

export type SignerFieldEditorType =
  | "signature"
  | "initial"
  | "date"
  | "text"
  | "checkbox"
  | "dropdown";

export type SignerFieldValidation =
  | "none"
  | "email"
  | "phone"
  | "currency"
  | "number"
  | "date"
  | "zip";

export const SIGNER_FIELD_VALIDATIONS: { id: SignerFieldValidation; label: string }[] = [
  { id: "none", label: "None" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "currency", label: "Currency" },
  { id: "number", label: "Number" },
  { id: "date", label: "Date" },
  { id: "zip", label: "ZIP / postal code" },
];

export type SignerFieldAttrs = {
  fieldId: string;
  recipientId: string;
  type: SignerFieldEditorType;
  required: boolean;
  label: string;
  placeholder: string;
  defaultValue: string;
  /** JSON string array for dropdown options, e.g. `["A","B"]` */
  dropdownOptions: string;
  /** Normalized 0–1, relative to the field canvas box or, on an overlay, to one page. */
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  /** 0-based page the field is anchored to. Only meaningful inside `fieldOverlay`. */
  page: number;
  multiline: boolean;
  validation: SignerFieldValidation;
  mergeField: string;
  maskValue: boolean;
};

export const defaultSignerFieldAttrs = (): Omit<SignerFieldAttrs, "fieldId" | "recipientId" | "type"> => ({
  required: true,
  label: "",
  placeholder: "",
  defaultValue: "",
  dropdownOptions: "[]",
  xPct: 0.04,
  yPct: 0.04,
  wPct: 0.38,
  hPct: 0.09,
  page: 0,
  multiline: false,
  validation: "none",
  mergeField: "",
  maskValue: false,
});

export function defaultPlaceholderForType(type: SignerFieldEditorType): string {
  switch (type) {
    case "text":
      return "Enter text...";
    case "date":
      return "Select date";
    case "signature":
      return "Signature";
    case "initial":
      return "Initials";
    case "dropdown":
      return "Select";
    case "checkbox":
      return "";
    default:
      return "";
  }
}

/** Single-line fillable fields: ~30px on Letter, tight around 12px type. */
export const SINGLE_LINE_FIELD_H_PCT = 0.028;

export function locksSingleLineHeight(type: SignerFieldEditorType, multiline: boolean): boolean {
  if (type === "text") {
    return !multiline;
  }
  return type === "date" || type === "checkbox" || type === "dropdown";
}

export function defaultSizeForType(type: SignerFieldEditorType): { wPct: number; hPct: number } {
  switch (type) {
    case "text":
      return { wPct: 0.32, hPct: SINGLE_LINE_FIELD_H_PCT };
    case "date":
      return { wPct: 0.24, hPct: SINGLE_LINE_FIELD_H_PCT };
    case "checkbox":
      return { wPct: 0.2, hPct: SINGLE_LINE_FIELD_H_PCT };
    case "dropdown":
      return { wPct: 0.28, hPct: SINGLE_LINE_FIELD_H_PCT };
    case "initial":
      return { wPct: 0.16, hPct: 0.07 };
    case "signature":
    default:
      return { wPct: 0.38, hPct: 0.09 };
  }
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function parseSignerFieldAttrs(raw: Record<string, unknown> | undefined, index: number): SignerFieldAttrs {
  const base = defaultSignerFieldAttrs();
  const typeRaw = String(raw?.type ?? "text");
  const type: SignerFieldEditorType =
    typeRaw === "signature" ||
    typeRaw === "initial" ||
    typeRaw === "date" ||
    typeRaw === "text" ||
    typeRaw === "checkbox" ||
    typeRaw === "dropdown"
      ? typeRaw
      : "text";

  const size = defaultSizeForType(type);
  const xPct = typeof raw?.xPct === "number" ? clamp01(raw.xPct) : base.xPct;
  const yPct = typeof raw?.yPct === "number" ? clamp01(raw.yPct) : clamp01(base.yPct + index * 0.11);
  const wPct = typeof raw?.wPct === "number" ? clamp01(raw.wPct) : size.wPct;
  const multiline = Boolean(raw?.multiline);
  let hPct = typeof raw?.hPct === "number" ? clamp01(raw.hPct) : size.hPct;
  if (locksSingleLineHeight(type, multiline)) {
    hPct = SINGLE_LINE_FIELD_H_PCT;
  }

  const validationRaw = String(raw?.validation ?? "none");
  const validation: SignerFieldValidation = SIGNER_FIELD_VALIDATIONS.some((item) => item.id === validationRaw)
    ? (validationRaw as SignerFieldValidation)
    : "none";

  let dropdownOptions = String(raw?.dropdownOptions ?? "[]");
  try {
    const parsed = JSON.parse(dropdownOptions) as unknown;
    if (!Array.isArray(parsed)) {
      dropdownOptions = "[]";
    }
  } catch {
    dropdownOptions = "[]";
  }

  return {
    fieldId: String(raw?.fieldId ?? ""),
    recipientId: String(raw?.recipientId ?? ""),
    type,
    required: raw?.required === undefined ? true : Boolean(raw.required),
    label: String(raw?.label ?? ""),
    placeholder: String(raw?.placeholder ?? defaultPlaceholderForType(type)),
    defaultValue: String(raw?.defaultValue ?? ""),
    dropdownOptions,
    xPct,
    yPct,
    wPct,
    hPct,
    page: Number.isFinite(Number(raw?.page)) ? Math.max(0, Math.trunc(Number(raw?.page))) : 0,
    multiline,
    validation,
    mergeField: String(raw?.mergeField ?? ""),
    maskValue: Boolean(raw?.maskValue),
  };
}

export function attrsToJson(attrs: SignerFieldAttrs): Record<string, JSONValue> {
  return {
    fieldId: attrs.fieldId,
    recipientId: attrs.recipientId,
    type: attrs.type,
    required: attrs.required,
    label: attrs.label,
    placeholder: attrs.placeholder,
    defaultValue: attrs.defaultValue,
    dropdownOptions: attrs.dropdownOptions,
    xPct: attrs.xPct,
    yPct: attrs.yPct,
    wPct: attrs.wPct,
    hPct: attrs.hPct,
    page: attrs.page,
    multiline: attrs.multiline,
    validation: attrs.validation,
    mergeField: attrs.mergeField,
    maskValue: attrs.maskValue,
  };
}

type Walkable = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Walkable[];
};

/** Overlay fields stored inside Tiptap JSON (`fieldOverlay` / `fieldCanvas` children). */
export function extractSigningFields(doc: { content?: Walkable[] } | null | undefined): SignerFieldAttrs[] {
  const fields: SignerFieldAttrs[] = [];
  function walk(node: Walkable, index: number) {
    if (node.type === "signerField") {
      fields.push(parseSignerFieldAttrs(node.attrs, index));
    }
    node.content?.forEach((child, childIndex) => walk(child, childIndex));
  }
  (doc?.content ?? []).forEach((child, index) => walk(child, index));
  return fields;
}

export function isDropdownField(field: SignerFieldAttrs): field is SignerFieldAttrs & { type: "dropdown" } {
  return field.type === "dropdown";
}

export function isCheckboxField(field: SignerFieldAttrs): field is SignerFieldAttrs & { type: "checkbox" } {
  return field.type === "checkbox";
}
