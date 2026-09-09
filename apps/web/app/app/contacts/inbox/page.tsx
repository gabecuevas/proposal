"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { EMAIL_INBOX_NAV } from "@/components/app-shell/nav-config";
import { IconSettings } from "@/components/app-shell/shell-icons";
import { SheetPage } from "@/components/ui/sheet-table";
import { parseEmailFolder, type EmailFolderId } from "@/lib/crm/emails";

type InboxMessage = {
  id: string;
  folder: EmailFolderId;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  messageAt: string;
};

const FOLDER_LABELS: Record<EmailFolderId, string> = {
  inbox: "Inbox",
  drafts: "Drafts",
  outbox: "Outbox",
  sent: "Sent",
  trash: "Trash",
};

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ContactsInboxPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folder = parseEmailFolder(searchParams.get("folder"));
  const composeOpen = searchParams.get("compose") === "1";

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composeSubject, setComposeSubject] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/emails?folder=${folder}`);
      if (!response.ok) {
        throw new Error("Failed to load emails");
      }
      const payload = (await response.json()) as { messages?: InboxMessage[] };
      setMessages(payload.messages ?? []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const folderLabel = FOLDER_LABELS[folder];
  const allSelected = messages.length > 0 && selectedIds.size === messages.length;

  const closeCompose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compose");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const emptyCopy = useMemo(() => {
    switch (folder) {
      case "drafts":
        return "No drafts yet. Start a new email to save one here.";
      case "outbox":
        return "Nothing waiting to send.";
      case "sent":
        return "Sent messages will appear here once Email Sync is connected.";
      case "trash":
        return "Trash is empty.";
      default:
        return "Connect Email Sync to pull inbound and outbound mail into this inbox.";
    }
  }, [folder]);

  return (
    <SheetPage
      error={error ?? undefined}
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={messages.length === 0}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds(new Set(messages.map((message) => message.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="sr-only">Select all</span>
            </label>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
            >
              Refresh
            </button>
            <p className="text-sm text-muted">
              {loading
                ? "Loading…"
                : `${messages.length} ${messages.length === 1 ? "conversation" : "conversations"}`}
              <span className="mx-1.5 text-border">·</span>
              <span className="font-medium text-foreground">{folderLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/settings/integrations/email"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
            >
              <IconSettings className="h-3.5 w-3.5" />
              Email Sync
            </Link>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {loading && messages.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">Loading emails…</p>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No emails in {folderLabel}</p>
            <p className="text-sm text-muted">{emptyCopy}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/app/settings/integrations/email"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Set up Email Sync
              </Link>
              <Link
                href="/app/contacts/inbox?compose=1"
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
              >
                New email
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {messages.map((message) => {
              const selected = selectedIds.has(message.id);
              return (
                <li key={message.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/80",
                      !message.isRead && "bg-primary/[0.03]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (event.target.checked) {
                            next.add(message.id);
                          } else {
                            next.delete(message.id);
                          }
                          return next;
                        });
                      }}
                      className="h-3.5 w-3.5 shrink-0 rounded border-border"
                      aria-label={`Select ${message.subject || "email"}`}
                    />
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        message.isRead ? "bg-transparent" : "bg-primary",
                      )}
                      aria-hidden
                    />
                    <div className="grid min-w-0 flex-1 grid-cols-[140px_minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                      <p
                        className={cn(
                          "truncate text-sm",
                          message.isRead ? "font-medium text-foreground" : "font-semibold text-foreground",
                        )}
                      >
                        {message.fromName || message.fromAddress}
                      </p>
                      <p className="min-w-0 truncate text-sm text-foreground">
                        <span className={cn(!message.isRead && "font-semibold")}>
                          {message.subject || "(No subject)"}
                        </span>
                        {message.snippet ? (
                          <span className="text-muted"> — {message.snippet}</span>
                        ) : null}
                      </p>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {message.hasAttachments ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-label="Has attachment"
                            className="text-muted"
                          >
                            <path
                              d="M8 12.5V8.2a4 4 0 018 0V15a5.5 5.5 0 11-11 0V9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : null}
                        <time dateTime={message.messageAt}>{formatMessageTime(message.messageAt)}</time>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto border-t border-border px-4 py-2">
          <p className="text-xs text-muted">
            Folders:{" "}
            {EMAIL_INBOX_NAV.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? <span className="text-border"> · </span> : null}
                <Link href={item.href} className="text-primary hover:underline">
                  {item.label}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-email-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="compose-email-title" className="text-sm font-semibold text-foreground">
                New email
              </h2>
              <button
                type="button"
                onClick={closeCompose}
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-slate-50 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="space-y-0 border-b border-border px-4">
              <label className="flex items-center gap-3 border-b border-border py-2 text-sm">
                <span className="w-14 shrink-0 text-muted">To</span>
                <input
                  value={composeTo}
                  onChange={(event) => setComposeTo(event.target.value)}
                  placeholder="recipient@example.com"
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted/70"
                />
              </label>
              <label className="flex items-center gap-3 py-2 text-sm">
                <span className="w-14 shrink-0 text-muted">Subject</span>
                <input
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Subject"
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted/70"
                />
              </label>
            </div>
            <textarea
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
              placeholder="Write your email…"
              className="min-h-[220px] flex-1 resize-none px-4 py-3 text-sm text-foreground outline-none"
            />
            <div className="flex items-center justify-between border-t border-border bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-muted">Sending requires Email Sync (Google).</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCompose}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-white"
                >
                  Discard
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SheetPage>
  );
}
