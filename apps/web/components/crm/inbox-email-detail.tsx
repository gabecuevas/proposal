"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  IconArrowLeft,
  IconEnvelope,
  IconReply,
  IconTrash,
} from "@/components/app-shell/shell-icons";
import { sanitizeEmailHtmlForDisplay } from "@/lib/crm/notes-html";
import type { CrmEmailListItem } from "@/lib/crm/emails";
import { splitContactName } from "@/lib/crm/split-contact-name";

type InboxEmailDetailProps = {
  messageId: string;
  onBack: () => void;
  onDeleted: () => void;
  onUnread: () => void;
  onReply: (message: CrmEmailListItem) => void;
  onCreateLeadReply: (message: CrmEmailListItem, lead: CreateLeadForm) => Promise<void>;
};

export type CreateLeadForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
};

function formatDetailTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const absolute = date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const diffMs = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let relative = "";
  if (diffMs >= dayMs) {
    const days = Math.round(diffMs / dayMs);
    relative = days === 1 ? "1 day ago" : `${days} days ago`;
  } else if (diffMs >= 60 * 60 * 1000) {
    const hours = Math.round(diffMs / (60 * 60 * 1000));
    relative = hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else {
    const mins = Math.max(1, Math.round(diffMs / (60 * 1000)));
    relative = mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  }
  return `${absolute} (${relative})`;
}

function EmailBody({ message }: { message: CrmEmailListItem }) {
  const html = message.bodyHtml?.trim() || "";
  const text = message.bodyText?.trim() || "";
  const safeHtml = useMemo(() => (html ? sanitizeEmailHtmlForDisplay(html) : ""), [html]);

  useEffect(() => {
    if (!safeHtml) {
      return;
    }
    const frame = document.getElementById(`email-frame-${message.id}`) as HTMLIFrameElement | null;
    if (!frame) {
      return;
    }
    const resize = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) {
          return;
        }
        const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 320);
        frame.style.height = `${height + 24}px`;
      } catch {
        // Cross-origin restrictions should not apply to srcDoc frames.
      }
    };
    frame.addEventListener("load", resize);
    resize();
    return () => frame.removeEventListener("load", resize);
  }, [message.id, safeHtml]);

  if (safeHtml) {
    return (
      <iframe
        id={`email-frame-${message.id}`}
        title="Email body"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        referrerPolicy="no-referrer"
        className="w-full min-h-[320px] rounded-lg border border-border bg-white"
        srcDoc={safeHtml}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white px-5 py-4">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
        {text || message.snippet || "(No content)"}
      </pre>
    </div>
  );
}

export function InboxEmailDetail({
  messageId,
  onBack,
  onDeleted,
  onUnread,
  onReply,
  onCreateLeadReply,
}: InboxEmailDetailProps) {
  const [message, setMessage] = useState<CrmEmailListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState<CreateLeadForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
  });
  const [leadError, setLeadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/crm/emails/${encodeURIComponent(messageId)}`);
        if (!response.ok) {
          throw new Error("Failed to load email");
        }
        const payload = (await response.json()) as { message?: CrmEmailListItem };
        if (!cancelled) {
          setMessage(payload.message ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load email");
          setMessage(null);
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
  }, [messageId]);

  const recipientLabel = useMemo(() => {
    if (!message) {
      return "";
    }
    if (message.toAddresses.length === 0) {
      return "me";
    }
    return message.toAddresses.join(", ");
  }, [message]);

  async function runAction(action: "trash" | "markUnread") {
    if (!message || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [message.id] }),
      });
      if (!response.ok) {
        throw new Error("Could not update email");
      }
      if (action === "trash") {
        onDeleted();
      } else {
        setMessage({ ...message, isRead: false });
        onUnread();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update email");
    } finally {
      setBusy(false);
    }
  }

  function startReply() {
    if (!message) {
      return;
    }
    if (message.contactId || message.leadId) {
      onReply(message);
      return;
    }
    const names = splitContactName(message.fromName || message.fromAddress.split("@")[0] || "Lead");
    setLeadForm({
      first_name: names.first_name || "Lead",
      last_name: names.last_name || "Contact",
      email: message.fromAddress,
      phone: "",
      title: message.subject || `Email from ${message.fromAddress}`,
    });
    setLeadError(null);
    setLeadModalOpen(true);
  }

  async function submitCreateLead() {
    if (!message) {
      return;
    }
    setLeadError(null);
    setBusy(true);
    try {
      await onCreateLeadReply(message, leadForm);
      setLeadModalOpen(false);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Could not create lead");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-8 text-sm text-muted">Loading email…</p>;
  }

  if (!message) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-muted">{error || "Email not found."}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Back to inbox
        </button>
      </div>
    );
  }

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
          onClick={() => void runAction("trash")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground disabled:opacity-40"
          title="Delete"
          aria-label="Delete"
        >
          <IconTrash className="h-[1.05rem] w-[1.05rem]" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAction("markUnread")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground disabled:opacity-40"
          title="Mark as unread"
          aria-label="Mark as unread"
        >
          <IconEnvelope className="h-[1.05rem] w-[1.05rem]" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={startReply}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground disabled:opacity-40"
          title="Reply"
          aria-label="Reply"
        >
          <IconReply className="h-[1.05rem] w-[1.05rem]" />
        </button>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {message.subject || "(No subject)"}
        </h1>

        <div className="mt-4 flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white"
            aria-hidden
          >
            {(message.fromName || message.fromAddress).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {message.fromName || message.fromAddress}
                  <span className="ml-1.5 font-normal text-muted">&lt;{message.fromAddress}&gt;</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">to {recipientLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <time className="text-xs text-muted" dateTime={message.messageAt}>
                  {formatDetailTimestamp(message.messageAt)}
                </time>
                <button
                  type="button"
                  disabled={busy}
                  onClick={startReply}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-slate-50 hover:text-foreground"
                  title="Reply"
                  aria-label="Reply"
                >
                  <IconReply className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <EmailBody message={message} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 pb-8">
          <button
            type="button"
            disabled={busy}
            onClick={startReply}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground",
              "hover:bg-slate-50 disabled:opacity-40",
            )}
          >
            <IconReply className="h-3.5 w-3.5" />
            Reply
          </button>
        </div>
      </div>

      {leadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-reply-title"
            className="w-full max-w-md rounded-lg border border-border bg-white p-4 shadow-xl"
          >
            <h2 id="create-lead-reply-title" className="text-sm font-semibold text-foreground">
              Create lead to reply
            </h2>
            <p className="mt-1 text-xs text-muted">
              This sender is not in your CRM. Create a lead, then continue the reply from the lead
              record.
            </p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-muted">
                First name
                <input
                  value={leadForm.first_name}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, first_name: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                Last name
                <input
                  value={leadForm.last_name}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, last_name: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                Email
                <input
                  value={leadForm.email}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                Phone
                <input
                  value={leadForm.phone}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Required"
                  className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs text-muted">
                Lead title
                <input
                  value={leadForm.title}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
            {leadError ? <p className="mt-2 text-xs text-red-600">{leadError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeadModalOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitCreateLead()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Create lead & reply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
