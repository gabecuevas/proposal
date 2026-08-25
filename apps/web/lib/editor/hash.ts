import { createHash } from "node:crypto";
import { normalizeStable, serializeStable } from "./stable";
import type { EditorDoc, JSONValue, SignerFieldValue, VariableContext } from "./types";

/**
 * Send-time identity of the document the recipient received.
 * Does not include signer-entered values.
 */
export function computeSnapshotHash(payload: {
  editor_json: EditorDoc;
  pricing_json: JSONValue;
  variables_json: VariableContext;
  resolved_variables: Record<string, JSONValue>;
  recipients_json: JSONValue;
  schema_version: number;
}): string {
  const normalized = {
    editor_json: serializeStable(payload.editor_json),
    pricing_json: normalizeStable(payload.pricing_json),
    variables_json: normalizeStable(payload.variables_json),
    resolved_variables: normalizeStable(payload.resolved_variables),
    recipients_json: normalizeStable(payload.recipients_json),
    schema_version: payload.schema_version,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Completion identity stored as Document.doc_hash.
 * Signer values change this hash; they do not change snapshot_hash.
 */
export function computeCompletionHash(payload: {
  snapshot_hash: string;
  signer_field_values: SignerFieldValue[];
}): string {
  const normalized = {
    snapshot_hash: payload.snapshot_hash,
    signer_field_values: normalizeStable(payload.signer_field_values as unknown as JSONValue),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/** @deprecated Use computeCompletionHash. Kept for existing finalize call sites during the swap. */
export function computeDocumentHash(payload: {
  editor_json: EditorDoc;
  resolved_variables: Record<string, JSONValue>;
  pricing_json: JSONValue;
  signer_field_values: SignerFieldValue[];
  snapshot_hash?: string;
}): string {
  if (payload.snapshot_hash) {
    return computeCompletionHash({
      snapshot_hash: payload.snapshot_hash,
      signer_field_values: payload.signer_field_values,
    });
  }
  const snapshot_hash = computeSnapshotHash({
    editor_json: payload.editor_json,
    pricing_json: payload.pricing_json,
    variables_json: {},
    resolved_variables: payload.resolved_variables,
    recipients_json: [],
    schema_version: 1,
  });
  return computeCompletionHash({ snapshot_hash, signer_field_values: payload.signer_field_values });
}
