/** Shared drag MIME for fillable fields from the tray onto the page. */
export const FIELD_DRAG_MIME = "application/x-signer-field";

/** Dispatched from the editor when a field is dropped over ProseMirror content. */
export const FIELD_DROP_EVENT = "senddox:field-drop";

export type FieldDropDetail = {
  type: string;
  clientX: number;
  clientY: number;
};
