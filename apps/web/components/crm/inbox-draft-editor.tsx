"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconTrash } from "@/components/app-shell/shell-icons";
import { CrmEmailComposer } from "@/components/crm/crm-email-composer";
import type { CrmEmailListItem } from "@/lib/crm/emails";

type InboxDraftEditorProps = {
  draftId: string;
  onBack: () => void;
  onDeleted: () => void;
  onSent: () => void;
};

export function InboxDraftEditor({ draftId, onBack, onDeleted, onSent }: InboxDraftEditorProps) {
  const [draft, setDraft] = useState<CrmEmailListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/crm/emails/${encodeURIComponent(draftId)}`);
        if (!response.ok) {
          throw new Error("Failed to load draft");
        }
        const payload = (await response.json()) as { message?: CrmEmailListItem };
        if (!cancelled) {
          const message = payload.message ?? null;
          if (message && message.folder !== "drafts") {
            throw new Error("This message is no longer a draft.");
          }
          setDraft(message);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load draft");
          setDraft(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  async function deleteDraft() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trash", ids: [draftId] }),
      });
      if (!response.ok) {
        throw new Error("Could not delete draft");
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete draft");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-8 text-sm text-muted">Loading draft…</p>;
  }

  if (!draft) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-muted">{error || "Draft not found."}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Back to Drafts
        </button>
      </div>
    );
  }

  const recordType = draft.contactId
    ? "contact"
    : draft.leadId
      ? "lead"
      : draft.companyId
        ? "company"
        : undefined;
  const recordId = draft.contactId || draft.leadId || draft.companyId || undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground"
          title="Back"
          aria-label="Back"
        >
          <IconArrowLeft className="h-[1.05rem] w-[1.05rem]" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteDraft()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground disabled:opacity-40"
          title="Delete draft"
          aria-label="Delete draft"
        >
          <IconTrash className="h-[1.05rem] w-[1.05rem]" />
        </button>
        <p className="ml-2 text-sm font-medium text-foreground">
          Draft
          <span className="ml-2 font-normal text-muted">
            {draft.subject?.trim() || "(no subject)"}
          </span>
        </p>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <CrmEmailComposer
          key={draft.id}
          draftId={draft.id}
          recordType={recordType}
          recordId={recordId}
          companyId={draft.companyId}
          primaryContactId={draft.contactId}
          defaultTo={draft.toAddresses}
          defaultSubject={draft.subject}
          defaultBodyHtml={
            draft.bodyHtml?.trim() ||
            (draft.bodyText?.trim()
              ? `<pre style="white-space:pre-wrap;font-family:inherit">${draft.bodyText
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")}</pre>`
              : "<p></p>")
          }
          onSent={onSent}
          onDraftSaved={() => {
            // Keep editing the same draft after save.
          }}
        />
      </div>
    </div>
  );
}
