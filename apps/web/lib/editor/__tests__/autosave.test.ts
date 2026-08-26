import { describe, expect, it } from "vitest";
import { formatEditorSaveStatus, isEditorSaving } from "../autosave";

describe("formatEditorSaveStatus", () => {
  it("shows a Google Docs-style saving label", () => {
    expect(formatEditorSaveStatus("Saving...")).toBe("Saving…");
    expect(formatEditorSaveStatus("Saving…")).toBe("Saving…");
    expect(isEditorSaving("Saving...")).toBe(true);
  });

  it("collapses idle and saved into Saved", () => {
    expect(formatEditorSaveStatus("Idle")).toBe("Saved");
    expect(formatEditorSaveStatus("Saved just now")).toBe("Saved");
  });
});
