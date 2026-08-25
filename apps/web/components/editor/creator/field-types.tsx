import type { ReactElement } from "react";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { FIELD_REGISTRY } from "@/lib/editor/field-registry";
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

const FIELD_ICONS: Record<string, (props: { className?: string }) => ReactElement> = {
  signature: IconSignature,
  initials: IconInitials,
  text: IconTextField,
  date: IconDate,
  file: IconFileUpload,
  radio: IconRadio,
  checkbox: IconCheckbox,
  dropdown: IconDropdown,
  card: IconCard,
  stamp: IconStamp,
};

export type FieldTypeEntry = {
  id: string;
  label: string;
  Icon: (props: { className?: string }) => ReactElement;
  /** Set when the type maps onto a field the signing flow can actually collect. */
  editorType: SignerFieldEditorType | null;
};

export const fieldTypes: FieldTypeEntry[] = FIELD_REGISTRY.map((entry) => ({
  ...entry,
  Icon: FIELD_ICONS[entry.id] ?? IconTextField,
}));

/** How many rows stay visible when the tray is collapsed. */
export const COLLAPSED_FIELD_COUNT = 4;

export const FIELD_DRAG_MIME = "application/x-signer-field";
