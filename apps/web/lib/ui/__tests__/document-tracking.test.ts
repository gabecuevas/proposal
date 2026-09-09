import { describe, expect, it } from "vitest";
import {
  countDocumentsForTab,
  documentStatusDisplayLabel,
  documentTrackingCounts,
  matchesDocumentTab,
  toDocumentTrackingTab,
} from "../document-tracking";

describe("toDocumentTrackingTab", () => {
  it("defaults to in-progress", () => {
    expect(toDocumentTrackingTab(null)).toBe("in-progress");
    expect(toDocumentTrackingTab(undefined)).toBe("in-progress");
    expect(toDocumentTrackingTab("all")).toBe("in-progress");
  });

  it("maps legacy query params onto the new views", () => {
    expect(toDocumentTrackingTab("sent")).toBe("unviewed");
    expect(toDocumentTrackingTab("expired")).toBe("archived");
  });
});

describe("matchesDocumentTab", () => {
  it("treats sent and opened docs as in progress, not drafts or completed", () => {
    expect(matchesDocumentTab("in-progress", "SENT")).toBe(true);
    expect(matchesDocumentTab("in-progress", "VIEWED")).toBe(true);
    expect(matchesDocumentTab("in-progress", "COMMENTED")).toBe(true);
    expect(matchesDocumentTab("in-progress", "DRAFTED")).toBe(false);
    expect(matchesDocumentTab("in-progress", "SIGNED")).toBe(false);
    expect(matchesDocumentTab("in-progress", "EXPIRED")).toBe(false);
  });

  it("splits viewed, unviewed, completed, declined, and archived", () => {
    expect(matchesDocumentTab("unviewed", "SENT")).toBe(true);
    expect(matchesDocumentTab("unviewed", "VIEWED")).toBe(false);
    expect(matchesDocumentTab("viewed", "VIEWED")).toBe(true);
    expect(matchesDocumentTab("viewed", "SENT")).toBe(false);
    expect(matchesDocumentTab("completed", "SIGNED")).toBe(true);
    expect(matchesDocumentTab("completed", "PAID")).toBe(true);
    expect(matchesDocumentTab("declined", "VOID")).toBe(true);
    expect(matchesDocumentTab("declined", "EXPIRED")).toBe(false);
    expect(matchesDocumentTab("archived", "EXPIRED")).toBe(true);
    expect(matchesDocumentTab("draft", "DRAFTED")).toBe(true);
  });

  it("leaves pending and trash empty until those statuses exist", () => {
    expect(matchesDocumentTab("pending", "VIEWED")).toBe(false);
    expect(matchesDocumentTab("pending", "SIGNED")).toBe(false);
    expect(matchesDocumentTab("trash", "VOID")).toBe(false);
    expect(matchesDocumentTab("trash", "DRAFTED")).toBe(false);
  });
});

describe("documentTrackingCounts", () => {
  it("rolls Prisma statuses into sidebar buckets", () => {
    const counts = documentTrackingCounts({
      DRAFTED: 25,
      SENT: 4,
      VIEWED: 2,
      COMMENTED: 1,
      SIGNED: 3,
      PAID: 1,
      EXPIRED: 2,
      VOID: 1,
    });
    expect(counts.inProgress).toBe(7);
    expect(counts.unviewed).toBe(4);
    expect(counts.viewed).toBe(3);
    expect(counts.completed).toBe(4);
    expect(counts.declined).toBe(1);
    expect(counts.draft).toBe(25);
    expect(counts.archived).toBe(2);
    expect(counts.pending).toBe(0);
    expect(counts.trash).toBe(0);
    expect(countDocumentsForTab({ SENT: 4 }, "unviewed")).toBe(4);
  });
});

describe("documentStatusDisplayLabel", () => {
  it("uses tracking language on the list badges", () => {
    expect(documentStatusDisplayLabel("SENT")).toBe("Unviewed");
    expect(documentStatusDisplayLabel("VOID")).toBe("Declined");
    expect(documentStatusDisplayLabel("EXPIRED")).toBe("Expired");
    expect(documentStatusDisplayLabel("SIGNED")).toBe("Completed");
  });
});
