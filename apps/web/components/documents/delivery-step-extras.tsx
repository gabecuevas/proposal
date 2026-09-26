"use client";

import { useState } from "react";
import { cn } from "@repo/ui/utils";

type VariableItem = { token: string; label: string; value: string };
type VariableGroup = { id: string; label: string; items: VariableItem[] };

function readString(source: unknown, key: string): string {
  if (!source || typeof source !== "object") {
    return "";
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function deliveryVariableGroups(input: {
  variables: unknown;
  recipient: { name: string; email: string } | null;
  publicUrl: string;
  title: string;
}): VariableGroup[] {
  const vars = (input.variables ?? {}) as Record<string, unknown>;
  const sender = vars.Sender;
  const recipientVars = vars.Recipient;
  const recipientName = input.recipient?.name?.trim() || readString(recipientVars, "FullName");
  return [
    {
      id: "document",
      label: "Document",
      items: [
        { token: "[Document.Link]", label: "Public link", value: input.publicUrl },
        { token: "[Document.Title]", label: "Title", value: input.title },
      ],
    },
    {
      id: "sender",
      label: "Sender",
      items: [
        { token: "[Sender.FullName]", label: "Full name", value: readString(sender, "FullName") },
        { token: "[Sender.CompanyName]", label: "Company", value: readString(sender, "CompanyName") },
        { token: "[Sender.Email]", label: "Email", value: readString(sender, "Email") },
        { token: "[Sender.Phone]", label: "Phone", value: readString(sender, "Phone") },
      ],
    },
    {
      id: "recipient",
      label: "Recipient",
      items: [
        { token: "[Recipient.FullName]", label: "Full name", value: recipientName },
        { token: "[Recipient.FirstName]", label: "First name", value: recipientName.split(/\s+/)[0] ?? "" },
        {
          token: "[Recipient.Email]",
          label: "Email",
          value: input.recipient?.email?.trim() || readString(recipientVars, "Email"),
        },
        { token: "[Recipient.CompanyName]", label: "Company", value: readString(recipientVars, "CompanyName") },
        { token: "[Recipient.Phone]", label: "Phone", value: readString(recipientVars, "Phone") },
      ],
    },
  ];
}

/** Right shelf on Review & Send: click a variable to insert it into the subject or message. */
export function DeliveryVariablesShelf({
  groups,
  onInsert,
}: {
  groups: VariableGroup[];
  onInsert: (token: string) => void;
}) {
  return (
    <aside
      aria-label="Variables"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Variables</h3>
        <p className="mt-0.5 text-xs text-muted">Click to insert into the subject or message.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <section key={group.id}>
            <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</h4>
            <ul className="mt-1 space-y-1">
              {group.items.map((item) => (
                <li key={item.token}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onInsert(item.token)}
                    className="w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-slate-50"
                  >
                    <span className="block rounded bg-amber-100 px-1 font-mono text-[11px] text-amber-900 w-fit">
                      {item.token}
                    </span>
                    <span className={cn("mt-0.5 block truncate text-xs", item.value ? "text-foreground" : "text-muted")}>
                      {item.value || `No ${item.label.toLowerCase()} yet`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

/** "I'll deliver it myself" pop-up with the view-only public link. */
export function PublicLinkModal({
  url,
  noun,
  delivered,
  busy,
  onShared,
  onClose,
}: {
  url: string;
  noun: string;
  delivered: boolean;
  busy: boolean;
  onShared: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the URL stays selectable in the field.
    }
    onShared();
  }

  async function share() {
    if (!url) {
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: noun });
        onShared();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    await copy();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-link-title"
        className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id="public-link-title" className="text-lg font-semibold text-foreground">
            Public link
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-xl leading-none text-muted hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-muted">
            Share this URL with your recipient to let them view their {noun.toLowerCase()}. It&apos;s view-only, so
            they can&apos;t change it. Copy the link from the box below for easy sharing.
          </p>
          <div className="flex overflow-hidden rounded-md border border-border">
            <input
              readOnly
              value={url || "Generating link…"}
              aria-label="Public link"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!url || busy}
              aria-label="Copy link"
              title="Copy link"
              className="border-l border-border bg-slate-50 px-3 text-sm text-muted hover:bg-slate-100 disabled:opacity-50"
            >
              {copied ? "Copied" : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="8" y="3" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void share()}
              disabled={!url || busy}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <span aria-hidden>↪</span>
              Share
            </button>
            <p className="text-xs text-muted" role="status">
              {delivered
                ? "Marked as delivered and moved to In Progress."
                : "Copying or sharing the link marks this as delivered."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
