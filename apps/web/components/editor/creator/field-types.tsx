import type { ReactElement } from "react";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import {
  IconCard,
  IconCheckbox,
  IconDate,
  IconDropdown,
  IconFileUpload,
  IconInitials,
  IconRadio,
  IconSignature,
  IconStamp,
  IconTextField,
} from "./creator-icons";

export type FieldTypeEntry = {
  id: string;
  label: string;
  Icon: (props: { className?: string }) => ReactElement;
  /** Set when the type maps onto a field the signing flow can actually collect. */
  editorType: SignerFieldEditorType | null;
};

/**
 * Ordered to match the field tray. Entries without an `editorType` are shown so
 * the tray is complete, but stay disabled until the signing flow supports them.
 */
export const fieldTypes: FieldTypeEntry[] = [
  { id: "signature", label: "Signature", Icon: IconSignature, editorType: "signature" },
  { id: "initials", label: "Initials", Icon: IconInitials, editorType: "initial" },
  { id: "text", label: "Text field", Icon: IconTextField, editorType: "text" },
  { id: "date", label: "Date", Icon: IconDate, editorType: "date" },
  { id: "file", label: "File upload", Icon: IconFileUpload, editorType: null },
  { id: "radio", label: "Radio buttons", Icon: IconRadio, editorType: null },
  { id: "checkbox", label: "Checkbox", Icon: IconCheckbox, editorType: "checkbox" },
  { id: "dropdown", label: "Dropdown", Icon: IconDropdown, editorType: "dropdown" },
  { id: "card", label: "Card details", Icon: IconCard, editorType: null },
  { id: "stamp", label: "Stamp", Icon: IconStamp, editorType: null },
];

/** How many rows stay visible when the tray is collapsed. */
export const COLLAPSED_FIELD_COUNT = 4;

export const FIELD_DRAG_MIME = "application/x-signer-field";
