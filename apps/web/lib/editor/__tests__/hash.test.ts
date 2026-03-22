import { describe, expect, test } from "vitest";
import { computeDocumentHash } from "../hash";
import type { EditorDoc } from "../types";

const docA: EditorDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

describe("computeDocumentHash", () => {
  test("is deterministic across key ordering differences", () => {
    const first = computeDocumentHash({
      editor_json: docA,
      pricing_json: { b: 2, a: 1 },
      resolved_variables: { "client.name": "Alice", "deal.value": 100 },
      signer_field_values: [
        {
          fieldId: "f1",
          recipientId: "r1",
          type: "signature",
          required: true,
          value: "Alice",
        },
      ],
    });

    const second = computeDocumentHash({
      editor_json: docA,
      pricing_json: { a: 1, b: 2 },
      resolved_variables: { "deal.value": 100, "client.name": "Alice" },
      signer_field_values: [
        {
          fieldId: "f1",
          recipientId: "r1",
          type: "signature",
          required: true,
          value: "Alice",
        },
      ],
    });

    expect(first).toBe(second);
  });
});
