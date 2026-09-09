import { describe, expect, it } from "vitest";
import { buildDocumentSentNoteHtml } from "@/lib/crm/document-sent-crm";

describe("buildDocumentSentNoteHtml", () => {
  it("builds summary and linked HTML note", () => {
    const sentAt = new Date("2026-03-15T20:45:00.000Z");
    const result = buildDocumentSentNoteHtml({
      documentId: "doc_123",
      title: "Q2 Proposal",
      senderName: "Alex Sender",
      recipientNames: ["Jamie Recipient"],
      sentAt,
    });

    expect(result.summary).toContain("Document Sent: Q2 Proposal by Alex Sender to Jamie Recipient on");
    expect(result.html).toContain('href="/app/documents/doc_123"');
    expect(result.html).toContain(">Q2 Proposal</a>");
    expect(result.html).toContain("by Alex Sender to Jamie Recipient on");
  });

  it("escapes HTML in title and names", () => {
    const result = buildDocumentSentNoteHtml({
      documentId: "doc_1",
      title: '<script>alert(1)</script>',
      senderName: "A & B",
      recipientNames: ['"C"'],
      sentAt: new Date("2026-01-01T12:00:00.000Z"),
    });

    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("A &amp; B");
  });
});
