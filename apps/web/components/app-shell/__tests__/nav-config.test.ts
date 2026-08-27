import { describe, expect, it } from "vitest";
import { appSections, isNavItemActive } from "../nav-config";

const documents = appSections.find((section) => section.id === "documents")!;

describe("documents sidebar tracking", () => {
  it("lists tracking statuses in the specified order", () => {
    expect(documents.items.map((item) => item.label)).toEqual([
      "In Progress",
      "Completed",
      "Viewed",
      "Unviewed",
      "Declined",
      "Drafts",
      "Archived/Expired",
      "Pending",
      "Trash",
    ]);
  });

  it("selects In Progress as the default documents view", () => {
    const inProgress = documents.items[0]!;
    expect(isNavItemActive(inProgress, "/app/documents", null, "")).toBe(true);
    expect(isNavItemActive(inProgress, "/app/documents", "in-progress", "")).toBe(true);
    expect(isNavItemActive(inProgress, "/app/documents", "completed", "")).toBe(false);
    expect(isNavItemActive(documents.items[1]!, "/app/documents", "completed", "")).toBe(true);
  });
});
