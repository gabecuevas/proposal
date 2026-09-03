import { describe, expect, it } from "vitest";
import {
  isEmptyNoteHtml,
  isNoteOverLimit,
  normalizeNoteHtml,
  noteSizeBytes,
  noteSizePercent,
  NOTE_SIZE_LIMIT_BYTES,
} from "../notes-html";

describe("notes-html", () => {
  it("treats empty editor html as empty", () => {
    expect(isEmptyNoteHtml("")).toBe(true);
    expect(isEmptyNoteHtml("<p></p>")).toBe(true);
    expect(isEmptyNoteHtml("<p><br></p>")).toBe(true);
    expect(isEmptyNoteHtml("<p>Hi</p>")).toBe(false);
  });

  it("normalizes empty html to blank string", () => {
    expect(normalizeNoteHtml("<p></p>")).toBe("");
    expect(normalizeNoteHtml("<p>Note</p>")).toBe("<p>Note</p>");
  });

  it("computes size percent against 100KB limit", () => {
    expect(noteSizePercent("")).toBe(0);
    expect(NOTE_SIZE_LIMIT_BYTES).toBe(100 * 1024);
    const half = "a".repeat(NOTE_SIZE_LIMIT_BYTES / 2);
    expect(noteSizePercent(half)).toBe(50);
    expect(isNoteOverLimit(half)).toBe(false);
    const over = "a".repeat(NOTE_SIZE_LIMIT_BYTES + 1);
    expect(noteSizeBytes(over)).toBe(NOTE_SIZE_LIMIT_BYTES + 1);
    expect(isNoteOverLimit(over)).toBe(true);
  });
});
