import { createHash } from "node:crypto";
import { normalizeStable, serializeStable } from "./stable";
import type { EditorDoc, JSONValue, SignerFieldValue } from "./types";

type HashPayload = {
  editor_json: EditorDoc;
  resolved_variables: Record<string, JSONValue>;
  pricing_json: JSONValue;
  signer_field_values: SignerFieldValue[];
};

export function computeDocumentHash(payload: HashPayload): string {
  const normalized = {
    editor_json: serializeStable(payload.editor_json),
    resolved_variables: normalizeStable(payload.resolved_variables),
    pricing_json: normalizeStable(payload.pricing_json),
    signer_field_values: normalizeStable(payload.signer_field_values as unknown as JSONValue),
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
