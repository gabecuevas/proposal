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
import { FIELD_DRAG_MIME } from "@/lib/editor/field-drag";

export { FIELD_DRAG_MIME };

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

export function setFieldDragPreview(event: { dataTransfer: DataTransfer }, label: string) {
  if (typeof document === "undefined") {
    return;
  }
  const ghost = document.createElement("div");
  ghost.style.cssText =
    "position:absolute;top:-200px;left:-200px;pointer-events:none;font:12px ui-sans-serif,system-ui,sans-serif";
  ghost.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;align-items:center;gap:4px">
      <span style="background:#1e3a5f;color:#fff;border-radius:999px;padding:2px 8px;font-size:11px">${label}</span>
      <span style="width:22px;height:22px;border-radius:999px;background:#1e3a5f"></span>
    </div>
    <div style="width:180px;height:32px;border:1px solid #1e3a5f;background:#fff;color:#94a3b8;display:flex;align-items:center;padding:0 8px;border-radius:2px">Enter text...</div>
  </div>`;
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 16, 28);
  window.setTimeout(() => ghost.remove(), 0);
}
