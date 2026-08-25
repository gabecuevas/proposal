import type { JSONValue } from "./types";

export type SignerFieldEditorType =
  | "signature"
  | "initial"
  | "date"
  | "text"
  | "checkbox"
  | "dropdown";

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
});

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

  const xPct = typeof raw?.xPct === "number" ? clamp01(raw.xPct) : base.xPct;
  const yPct = typeof raw?.yPct === "number" ? clamp01(raw.yPct) : clamp01(base.yPct + index * 0.11);
  const wPct = typeof raw?.wPct === "number" ? clamp01(raw.wPct) : base.wPct;
  const hPct = typeof raw?.hPct === "number" ? clamp01(raw.hPct) : base.hPct;

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
    placeholder: String(raw?.placeholder ?? ""),
    defaultValue: String(raw?.defaultValue ?? ""),
    dropdownOptions,
    xPct,
    yPct,
    wPct,
    hPct,
    page: Number.isFinite(Number(raw?.page)) ? Math.max(0, Math.trunc(Number(raw?.page))) : 0,
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
