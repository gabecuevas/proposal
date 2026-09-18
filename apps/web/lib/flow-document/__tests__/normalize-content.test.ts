import { describe, expect, it } from "vitest";
import { editorDocHasTable, flattenTablesInEditorDoc } from "../normalize-content";
import type { EditorDoc } from "@/lib/editor/types";

describe("flattenTablesInEditorDoc", () => {
  it("unwraps table cells into sequential blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Left" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Right" }] }],
                },
              ],
            },
          ],
        },
      ],
    } as EditorDoc;

    expect(editorDocHasTable(doc)).toBe(true);
    const flat = flattenTablesInEditorDoc(doc);
    expect(editorDocHasTable(flat)).toBe(false);
    expect(JSON.stringify(flat)).toContain("Left");
    expect(JSON.stringify(flat)).toContain("Right");
    expect(JSON.stringify(flat)).not.toContain('"type":"table"');
  });
});
