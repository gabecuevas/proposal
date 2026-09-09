import { describe, expect, it } from "vitest";
import {
  appSections,
  isNavItemActive,
  sidebarItemsForSection,
  topNavSections,
} from "../nav-config";
import { parseEmailFolder } from "@/lib/crm/emails";

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
      "Inbox",
    ]);
  });

  it("swaps Contacts shelf to mail folders on Inbox", () => {
    const contacts = appSections.find((section) => section.id === "contacts")!;
    expect(sidebarItemsForSection(contacts, "/app/contacts/inbox").map((item) => item.label)).toEqual([
      "Inbox",
      "Drafts",
      "Outbox",
      "Sent",
      "Trash",
    ]);
  });

  it("highlights the active Inbox folder from the folder query", () => {
    const drafts = sidebarItemsForSection(
      appSections.find((section) => section.id === "contacts")!,
      "/app/contacts/inbox",
    ).find((item) => item.label === "Drafts")!;
    expect(isNavItemActive(drafts, "/app/contacts/inbox", "drafts", "")).toBe(true);
    expect(isNavItemActive(drafts, "/app/contacts/inbox", null, "")).toBe(false);
    expect(parseEmailFolder(null)).toBe("inbox");
    expect(parseEmailFolder("trash")).toBe("trash");
  });
});
