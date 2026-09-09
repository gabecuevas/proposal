import type { SignerFieldEditorType } from "./signer-field-attrs";

export const SUPPORTED_SIGNING_FIELD_TYPES = [
  "signature",
  "initial",
  "date",
  "text",
  "checkbox",
  "dropdown",
] as const satisfies readonly SignerFieldEditorType[];

export const PLANNED_SIGNING_FIELD_TYPES = ["file", "radio", "card", "stamp"] as const;

export type PlannedSigningFieldType = (typeof PLANNED_SIGNING_FIELD_TYPES)[number];

export type FieldRegistryEntry = {
  id: string;
  label: string;
  editorType: SignerFieldEditorType | null;
};

/**
 * Shared field catalog. Overlay positioning and recipient IDs stay in
 * `signerField` attrs; this list is only type identity and tray labels.
 */
export const FIELD_REGISTRY: FieldRegistryEntry[] = [
  { id: "signature", label: "Signature", editorType: "signature" },
  { id: "initials", label: "Initials", editorType: "initial" },
  { id: "text", label: "Text field", editorType: "text" },
  { id: "date", label: "Date", editorType: "date" },
  { id: "file", label: "File upload", editorType: null },
  { id: "radio", label: "Radio buttons", editorType: null },
  { id: "checkbox", label: "Checkbox", editorType: "checkbox" },
  { id: "dropdown", label: "Dropdown", editorType: "dropdown" },
  { id: "card", label: "Card details", editorType: null },
  { id: "stamp", label: "Stamp", editorType: null },
];

export function isSupportedSigningFieldType(value: string): value is SignerFieldEditorType {
  return (SUPPORTED_SIGNING_FIELD_TYPES as readonly string[]).includes(value);
}

/** Prisma `FieldType` has no DROPDOWN; draft dropdowns persist as TEXT rows. */
export function prismaFieldType(
  type: SignerFieldEditorType,
): "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX" {
  if (type === "initial") {
    return "INITIALS";
  }
  if (type === "signature") {
    return "SIGNATURE";
  }
  if (type === "date") {
    return "DATE";
  }
  if (type === "checkbox") {
    return "CHECKBOX";
  }
  return "TEXT";
}
