import type { EditorDoc, EditorNode, JSONValue, PricingModel, VariableContext } from "./types";
import { computeCompletionHash, computeSnapshotHash } from "./hash";
import type { SignerFieldValue } from "./types";

export const SENT_SNAPSHOT_KIND = "send" as const;

export type DocumentRecipientJson = {
  id: string;
  email: string;
  name: string;
  role: "signer" | "approver" | "viewer";
  signing_order?: number;
};

export type ContentBlockPin = {
  editor_json: EditorDoc;
  version: number;
};

export type SentSnapshotRecord = {
  id: string;
  version_number: number;
  editor_json: EditorDoc;
  pricing_json: PricingModel;
  variables_json: VariableContext;
  resolved_variables: Record<string, JSONValue>;
  recipients_json: DocumentRecipientJson[];
  schema_version: number;
  snapshot_hash: string;
  snapshot_kind: string;
  sent_at: string;
};

export type RenderSource =
  | { kind: "send-snapshot"; snapshot: SentSnapshotRecord }
  | { kind: "legacy-live"; snapshot: SentSnapshotRecord };

export function isDraftEditableStatus(status: string): boolean {
  return status === "DRAFTED";
}

export function isSentLifecycleStatus(status: string): boolean {
  return status === "SENT" || status === "VIEWED" || status === "COMMENTED";
}

export function collectContentBlockIds(doc: EditorDoc | EditorNode): string[] {
  const ids: string[] = [];
  const walk = (node: EditorDoc | EditorNode) => {
    if ("type" in node && node.type === "contentBlockEmbed") {
      const blockId = String(node.attrs?.blockId ?? "");
      if (blockId) {
        ids.push(blockId);
      }
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  };
  walk(doc);
  return [...new Set(ids)];
}

/**
 * Pins reusable library content onto embed nodes. ContentBlock rows overwrite
 * `editor_json` on bump, so send-time inlining is the only way to freeze version A.
 */
export function pinContentBlockEmbeds(
  doc: EditorDoc,
  blocks: Map<string, ContentBlockPin>,
): EditorDoc {
  const pinNode = (node: EditorNode): EditorNode => {
    if (node.type === "contentBlockEmbed") {
      const blockId = String(node.attrs?.blockId ?? "");
      const block = blocks.get(blockId);
      return {
        ...node,
        attrs: {
          ...(node.attrs ?? {}),
          blockId,
          version: block?.version ?? Number(node.attrs?.version ?? 1),
          snapshotDoc: block ? (block.editor_json as unknown as JSONValue) : null,
        },
      };
    }
    return {
      ...node,
      content: node.content?.map(pinNode),
    };
  };
  return {
    type: "doc",
    attrs: doc.attrs,
    content: doc.content.map(pinNode),
  };
}

export function buildSnapshotHashInput(input: {
  editor_json: EditorDoc;
  pricing_json: PricingModel | JSONValue;
  variables_json: VariableContext;
  resolved_variables: Record<string, JSONValue>;
  recipients_json: DocumentRecipientJson[];
  schema_version: number;
}): string {
  return computeSnapshotHash(input);
}

export function buildCompletionHash(input: {
  snapshot_hash: string;
  signer_field_values: SignerFieldValue[];
}): string {
  return computeCompletionHash(input);
}
