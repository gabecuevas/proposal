import { describe, expect, test } from "vitest";
import { computeCompletionHash, computeSnapshotHash } from "../hash";
import type { EditorDoc } from "../types";

const docA: EditorDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const docB: EditorDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
};

const signature = {
  fieldId: "f1",
  recipientId: "r1",
  type: "signature" as const,
  required: true,
  value: "Alice",
};

describe("computeSnapshotHash", () => {
  test("is deterministic across key ordering", () => {
    const first = computeSnapshotHash({
      editor_json: docA,
      pricing_json: { b: 2, a: 1 },
      variables_json: { client: { name: "Alice" } },
      resolved_variables: { "client.name": "Alice", "deal.value": 100 },
      recipients_json: [{ id: "r1", email: "a@x.com", name: "A", role: "signer" }],
      schema_version: 1,
    });
    const second = computeSnapshotHash({
      editor_json: docA,
      pricing_json: { a: 1, b: 2 },
      variables_json: { client: { name: "Alice" } },
      resolved_variables: { "deal.value": 100, "client.name": "Alice" },
      recipients_json: [{ role: "signer", name: "A", email: "a@x.com", id: "r1" }],
      schema_version: 1,
    });
    expect(first).toBe(second);
  });

  test("changes when content, pricing, or field definitions change", () => {
    const base = {
      variables_json: {},
      resolved_variables: { "client.name": "Alice" },
      recipients_json: [{ id: "r1", email: "a@x.com", name: "A", role: "signer" as const }],
      schema_version: 1,
    };
    const content = computeSnapshotHash({
      ...base,
      editor_json: docA,
      pricing_json: { currency: "USD", items: [] },
    });
    const changedContent = computeSnapshotHash({
      ...base,
      editor_json: docB,
      pricing_json: { currency: "USD", items: [] },
    });
    const changedPricing = computeSnapshotHash({
      ...base,
      editor_json: docA,
      pricing_json: { currency: "USD", items: [{ id: "1", name: "Setup", quantity: 1, unitPrice: 100 }] },
    });
    const changedField = computeSnapshotHash({
      ...base,
      editor_json: {
        type: "doc",
        content: [
          {
            type: "signerField",
            attrs: { fieldId: "f1", recipientId: "r1", type: "signature", xPct: 0.1, yPct: 0.1, wPct: 0.2, hPct: 0.1 },
          },
        ],
      },
      pricing_json: { currency: "USD", items: [] },
    });
    expect(content).not.toBe(changedContent);
    expect(content).not.toBe(changedPricing);
    expect(content).not.toBe(changedField);
  });
});

describe("computeCompletionHash", () => {
  test("signer values change completion hash but not snapshot hash", () => {
    const snapshot_hash = computeSnapshotHash({
      editor_json: docA,
      pricing_json: { currency: "USD", items: [] },
      variables_json: {},
      resolved_variables: {},
      recipients_json: [],
      schema_version: 1,
    });
    const unsigned = computeCompletionHash({ snapshot_hash, signer_field_values: [] });
    const signed = computeCompletionHash({
      snapshot_hash,
      signer_field_values: [signature],
    });
    expect(unsigned).not.toBe(signed);
    expect(snapshot_hash).toHaveLength(64);
  });
});
