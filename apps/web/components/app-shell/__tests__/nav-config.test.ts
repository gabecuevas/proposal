import { describe, expect, it } from "vitest";
import { appSections, isNavItemActive, topNavSections } from "../nav-config";

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

describe("top nav and contacts", () => {
  it("puts Contacts in the top bar and keeps Settings out of it", () => {
    expect(topNavSections.map((section) => section.id)).toEqual([
      "dashboard",
      "documents",
      "library",
      "contacts",
    ]);
  });

  it("lists CRM views in the Contacts sidebar", () => {
    const contacts = appSections.find((section) => section.id === "contacts")!;
    expect(contacts.items.map((item) => item.label)).toEqual([
      "Leads",
      "People",
      "Companies",
      "Calendar",
    ]);
  });
});
