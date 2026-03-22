import { describe, expect, test } from "vitest";
import type { EditorDoc } from "../types";
import { serializeStable } from "../stable";

describe("serializeStable", () => {
  test("produces deterministic output for equivalent docs", () => {
    const docA: EditorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { b: "2", a: "1" },
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };

    const docB: EditorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { a: "1", b: "2" },
          content: [{ text: "Hello", type: "text" }],
        },
      ],
    };

    expect(serializeStable(docA)).toBe(serializeStable(docB));
  });
});
