import { describe, expect, it } from "vitest";
import { collectContentBlockIds, pinContentBlockEmbeds } from "../sent-snapshot";
import type { EditorDoc } from "../types";

const embedDoc: EditorDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
    { type: "contentBlockEmbed", attrs: { blockId: "blk_a", version: 1 } },
  ],
};

describe("pinContentBlockEmbeds", () => {
  it("inlines the library document onto the embed without copying pricing", () => {
    const library: EditorDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Library Version A" }] }],
    };
    const pinned = pinContentBlockEmbeds(
      embedDoc,
      new Map([["blk_a", { editor_json: library, version: 1 }]]),
    );
    const embed = pinned.content[1];
    expect(embed?.attrs?.blockId).toBe("blk_a");
    expect(embed?.attrs?.snapshotDoc).toEqual(library);
    expect(collectContentBlockIds(embedDoc)).toEqual(["blk_a"]);
  });
});
