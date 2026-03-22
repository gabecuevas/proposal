import { CURRENT_DOC_VERSION, type EditorDoc } from "./types";

export type VersionedEditorPayload = {
  doc_version: number;
  editor_json: EditorDoc;
};

export function migrateEditorDoc(payload: VersionedEditorPayload): VersionedEditorPayload {
  if (payload.doc_version === CURRENT_DOC_VERSION) {
    return payload;
  }

  if (payload.doc_version < 1) {
    return {
      doc_version: CURRENT_DOC_VERSION,
      editor_json: payload.editor_json,
    };
  }

  throw new Error(`Unsupported editor doc_version: ${payload.doc_version}`);
}
