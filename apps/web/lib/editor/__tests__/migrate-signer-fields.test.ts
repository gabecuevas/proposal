import { describe, expect, it } from "vitest";
import { migrateSignerFieldsDoc } from "../migrate-signer-fields";
import type { EditorDoc } from "../types";

describe("migrateSignerFieldsDoc", () => {
  it("preserves paragraph formatting attrs when there are no legacy inline fields", () => {
    const doc: EditorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center", lineHeight: "2", indent: 1 },
          content: [{ type: "text", text: "Keep me" }],
        },
      ],
    };
    expect(migrateSignerFieldsDoc(doc)).toEqual(doc);
  });
});
