"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { EMAIL_INBOX_NAV } from "@/components/app-shell/nav-config";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEllipsisVertical,
  IconEnvelopeOpen,
  IconRefresh,
  IconTrash,
} from "@/components/app-shell/shell-icons";
import { SheetPage } from "@/components/ui/sheet-table";
import {
  InboxEmailDetail,
  type CreateLeadForm,
} from "@/components/crm/inbox-email-detail";
import { InboxDraftEditor } from "@/components/crm/inbox-draft-editor";
import {
  buildQuotedReplyHtml,
  buildReplySubject,
  writeEmailReplyDraft,
} from "@/lib/crm/email-reply-draft";
import { parseEmailFolder, type CrmEmailListItem, type EmailFolderId } from "@/lib/crm/emails";

type InboxMessage = Pick<
  CrmEmailListItem,
  | "id"
  | "folder"
  | "fromName"
  | "fromAddress"
  | "toAddresses"
  | "subject"
  | "snippet"
  | "isRead"
  | "hasAttachments"
  | "messageAt"
>;

const FOLDER_LABELS: Record<EmailFolderId, string> = {
  inbox: "Inbox",
  drafts: "Drafts",
  outbox: "Outbox",
  sent: "Sent",
  trash: "Trash",
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const PAGE_SIZE_STORAGE_KEY = "crm-inbox-page-size";
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

function readStoredPageSize(): PageSize {
  if (typeof window === "undefined") {
    return 25;
  }
  const raw = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  return Number.isFinite(raw) && isPageSize(raw) ? raw : 25;
}

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

function formatRangeLabel(total: number, offset: number, count: number): string {
  if (total === 0) {
    return "0 of 0";
  }
  const start = offset + 1;
  const end = offset + count;
  return `${start}–${end} of ${total}`;
}

export default function ContactsInboxPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folder = parseEmailFolder(searchParams.get("folder"));
  const composeOpen = searchParams.get("compose") === "1";
  const openMessageId = searchParams.get("id")?.trim() || null;

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composeSubject, setComposeSubject] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(0);
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const pageSizeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageSize(readStoredPageSize());
  }, []);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [folder, pageSize]);

  const offset = page * pageSize;

  const loadMessages = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!options?.quiet) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch(
          `/api/crm/emails?folder=${folder}&limit=${pageSize}&offset=${offset}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load emails");
        }
        const payload = (await response.json()) as {
          messages?: InboxMessage[];
          total?: number;
        };
        const nextMessages = payload.messages ?? [];
        const nextTotal = typeof payload.total === "number" ? payload.total : nextMessages.length;
        setMessages(nextMessages);
        setTotal(nextTotal);
        setSelectedIds(new Set());
        const maxPage = Math.max(0, Math.ceil(nextTotal / pageSize) - 1);
        if (page > maxPage) {
          setPage(maxPage);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load emails");
        setMessages([]);
        setTotal(0);
      } finally {
        if (!options?.quiet) {
          setLoading(false);
        }
      }
    },
    [folder, offset, page, pageSize],
  );

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  const syncEmails = useCallback(async () => {
    try {
      await fetch("/api/crm/emails/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookback: "3days" }),
      });
    } catch {
      // Keep the inbox usable even if background sync fails.
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;

    async function runAutoSync() {
      await syncEmails();
      if (!cancelled) {
        await loadMessagesRef.current({ quiet: true });
      }
    }

    void runAutoSync();
    const intervalId = window.setInterval(() => {
      void runAutoSync();
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [syncEmails]);

  useEffect(() => {
    if (!pageSizeMenuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (pageSizeMenuRef.current && !pageSizeMenuRef.current.contains(event.target as Node)) {
        setPageSizeMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPageSizeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pageSizeMenuOpen]);

  const folderLabel = FOLDER_LABELS[folder];
  const allSelected = messages.length > 0 && selectedIds.size === messages.length;
  const hasSelection = selectedIds.size > 0;
  const canGoPrev = page > 0;
  const canGoNext = offset + messages.length < total;
  const rangeLabel = formatRangeLabel(total, offset, messages.length);

  const runBatchAction = useCallback(
    async (action: "markRead" | "trash") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || actionBusy) {
        return;
      }
      setActionBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/crm/emails", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Could not update emails");
        }
        setSelectedIds(new Set());
        await loadMessages({ quiet: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update emails");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, loadMessages, selectedIds],
  );

  const closeCompose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compose");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const setOpenMessageId = useCallback(
    (messageId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (messageId) {
        params.set("id", messageId);
      } else {
        params.delete("id");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const prepareReplyDraft = useCallback((message: CrmEmailListItem) => {
    const replyTo =
      message.direction === "OUTBOUND"
        ? message.toAddresses[0] || message.fromAddress
        : message.fromAddress;
    writeEmailReplyDraft({
      to: replyTo ? [replyTo] : [],
      subject: buildReplySubject(message.subject),
      bodyHtml: buildQuotedReplyHtml({
        fromName: message.fromName,
        fromAddress: message.fromAddress,
        messageAt: message.messageAt,
        bodyHtml: message.bodyHtml,
        bodyText: message.bodyText,
      }),
      messageId: message.id,
    });
  }, []);

  const handleReply = useCallback(
    (message: CrmEmailListItem) => {
      prepareReplyDraft(message);
      if (message.contactId) {
        router.push(`/app/contacts/people?open=${encodeURIComponent(message.contactId)}&tab=email`);
        return;
      }
      if (message.leadId) {
        router.push(`/app/contacts/leads?open=${encodeURIComponent(message.leadId)}&tab=email`);
      }
    },
    [prepareReplyDraft, router],
  );

  const handleCreateLeadReply = useCallback(
    async (message: CrmEmailListItem, lead: CreateLeadForm) => {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lead.title || message.subject || `Email from ${lead.email}`,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          source: "Inbox",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { lead?: { id: string }; error?: { message?: string }; message?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          payload?.error?.message || payload?.message || "Could not create lead",
        );
      }
      const leadId = payload?.lead?.id;
      if (!leadId) {
        throw new Error("Lead was created but no id was returned.");
      }

      await fetch(`/api/crm/emails/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });

      prepareReplyDraft({ ...message, leadId });
      router.push(`/app/contacts/leads?open=${encodeURIComponent(leadId)}&tab=email`);
    },
    [prepareReplyDraft, router],
  );

  const emptyCopy = useMemo(() => {
    switch (folder) {
      case "drafts":
        return "No drafts yet.";
      case "outbox":
        return "Scheduled emails will appear here until they are sent.";
      case "sent":
        return "Sent messages will appear here once Email Sync is connected.";
      case "trash":
        return "Trash is empty.";
      default:
        return "Connect Email Sync in Settings to pull inbound and outbound mail into this inbox.";
    }
  }, [folder]);

  function updatePageSize(next: PageSize) {
    setPageSize(next);
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    setPageSizeMenuOpen(false);
  }

  return (
    <SheetPage
      error={error ?? undefined}
      toolbar={
        openMessageId ? undefined : (
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
                title="Select all"
                aria-label="Select all"
              />
              <span className="sr-only">Select all</span>
            </label>
            <button
              type="button"
              disabled={loading || actionBusy}
              onClick={() => {
                void (async () => {
                  await syncEmails();
                  await loadMessages();
                })();
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Refresh"
              aria-label="Refresh"
            >
              <IconRefresh className="h-[1.05rem] w-[1.05rem]" />
            </button>
            {hasSelection ? (
              <>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runBatchAction("trash")}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  title="Delete"
                  aria-label="Delete"
                >
                  <IconTrash className="h-[1.05rem] w-[1.05rem]" />
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runBatchAction("markRead")}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  title="Mark as read"
                  aria-label="Mark as read"
                >
                  <IconEnvelopeOpen className="h-[1.05rem] w-[1.05rem]" />
                </button>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted">
            <span className="tabular-nums">{loading && messages.length === 0 ? "…" : rangeLabel}</span>
            <button
              type="button"
              disabled={!canGoPrev || loading}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Previous page"
              aria-label="Previous page"
            >
              <IconChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canGoNext || loading}
              onClick={() => setPage((value) => value + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Next page"
              aria-label="Next page"
            >
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="relative" ref={pageSizeMenuRef}>
              <button
                type="button"
                onClick={() => setPageSizeMenuOpen((open) => !open)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-slate-100 hover:text-foreground",
                  pageSizeMenuOpen && "bg-slate-100 text-foreground",
                )}
                title="Show up to"
                aria-label="Show up to"
                aria-haspopup="menu"
                aria-expanded={pageSizeMenuOpen}
              >
                <IconEllipsisVertical className="h-3.5 w-3.5" />
              </button>
              {pageSizeMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 text-sm text-foreground shadow-lg"
                >
                  <p className="px-3 py-1.5 text-xs font-medium text-muted">Show up to</p>
                  {PAGE_SIZE_OPTIONS.map((size) => {
                    const selected = size === pageSize;
                    return (
                      <button
                        key={size}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => updatePageSize(size)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="inline-flex w-4 shrink-0 justify-center text-foreground">
                          {selected ? "✓" : ""}
                        </span>
                        <span>{size} items</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {openMessageId ? (
          folder === "drafts" ? (
            <InboxDraftEditor
              draftId={openMessageId}
              onBack={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
              onDeleted={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
              onSent={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
            />
          ) : (
            <InboxEmailDetail
              messageId={openMessageId}
              onBack={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
              onDeleted={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
              onUnread={() => {
                setOpenMessageId(null);
                void loadMessages({ quiet: true });
              }}
              onReply={handleReply}
              onCreateLeadReply={handleCreateLeadReply}
            />
          )
        ) : loading && messages.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">Loading emails…</p>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No emails in {folderLabel}</p>
            <p className="text-sm text-muted">{emptyCopy}</p>
            {folder !== "drafts" && folder !== "outbox" ? (
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
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {messages.map((message) => {
              const selected = selectedIds.has(message.id);
              const isDraft = folder === "drafts";
              const draftRecipients =
                message.toAddresses?.length > 0 ? message.toAddresses.join(", ") : null;
              return (
                <li key={message.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenMessageId(message.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenMessageId(message.id);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-100/90",
                      !isDraft && !message.isRead && "bg-primary/[0.03]",
                      selected && "bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onClick={(event) => event.stopPropagation()}
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
                    {!isDraft ? (
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          message.isRead ? "bg-transparent" : "bg-primary",
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(120px,180px)_minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                      <p className="truncate text-sm text-foreground">
                        {isDraft ? (
                          <>
                            <span className="font-semibold text-red-600">Draft</span>
                            {draftRecipients ? (
                              <span className="font-normal text-foreground"> {draftRecipients}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className={message.isRead ? "font-normal" : "font-semibold"}>
                            {message.fromName || message.fromAddress}
                          </span>
                        )}
                      </p>
                      <p
                        className={cn(
                          "min-w-0 truncate text-sm text-foreground",
                          isDraft || message.isRead ? "font-normal" : "font-semibold",
                        )}
                      >
                        <span>{message.subject?.trim() || "(no subject)"}</span>
                        {message.snippet ? (
                          <span className="font-normal text-muted"> — {message.snippet}</span>
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

        {!openMessageId && folder !== "drafts" && folder !== "outbox" ? (
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
        ) : null}
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
