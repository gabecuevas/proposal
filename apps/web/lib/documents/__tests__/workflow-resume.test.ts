import { beforeEach, describe, expect, it, vi } from "vitest";
import { rememberWorkflowStep, workflowResumeTarget } from "../workflow-resume";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
});

const quote = { document_kind: "quote" };
const flow = { document_kind: "document", editor_layout: "flow" };
const creator = { document_kind: "document" };

describe("workflowResumeTarget", () => {
  it("sends drafts without recipients to Add Contact", () => {
    rememberWorkflowStep("d1", "review");
    expect(workflowResumeTarget({ documentId: "d1", variables: quote, hasRecipients: false })).toEqual({
      type: "panel",
      kind: "quote",
      step: 2,
    });
  });

  it("reopens the immersive editor for Quote and Flow drafts by default", () => {
    expect(workflowResumeTarget({ documentId: "d2", variables: quote, hasRecipients: true })).toEqual({
      type: "editor",
      href: "/app/documents/d2?afterUse=1",
    });
    expect(workflowResumeTarget({ documentId: "d3", variables: flow, hasRecipients: true }).type).toBe("editor");
  });

  it("uses the panel editor step for Creator drafts", () => {
    expect(workflowResumeTarget({ documentId: "d4", variables: creator, hasRecipients: true })).toEqual({
      type: "panel",
      kind: "document",
      step: 3,
    });
  });

  it("returns to Review & Send when that was the last step", () => {
    rememberWorkflowStep("d5", "review");
    expect(workflowResumeTarget({ documentId: "d5", variables: quote, hasRecipients: true })).toEqual({
      type: "panel",
      kind: "quote",
      step: 4,
    });
  });
});
