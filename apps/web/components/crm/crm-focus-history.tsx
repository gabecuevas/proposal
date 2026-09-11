"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import type { CrmActivityLinks } from "@/components/crm/activity-panel";
import {
  activityTypeLabel,
  type CrmActivityRecord,
} from "@/lib/crm/activity-shared";
import { HistoryFieldIcon, historyFieldIconId } from "@/lib/crm/history-field-icon";
import { formatGridDate, formatHistoryDateTime } from "@/lib/ui/datetime";
import { NotesHtml } from "@/components/crm/notes-html";
import { isEmptyNoteHtml } from "@/lib/crm/notes-html";
import type { CrmEmailListItem } from "@/lib/crm/emails";

export type FocusHistoryItem = {
  id: string;
  title: string;
  at: string;
  detail?: string;
  kind?: "note" | "created" | "change" | "activity" | "email";
  actorName?: string;
  fieldKey?: string | null;
};

type HistoryFilterId = "all" | "activities" | "notes" | "emails" | "changelog";

const EMAIL_BODY_COLLAPSE_CHARS = 180;

function isOverdue(activity: CrmActivityRecord): boolean {
  if (!activity.due_at || activity.completed_at) {
    return false;
  }
  return new Date(activity.due_at).getTime() < Date.now();
}

function MetaIconPerson() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c.8-3 3.2-4.5 7-4.5s6.2 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MetaIconCompany() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V7l8-3 8 3v13" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MetaIconDeal() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8v8M9.8 10c.4-.9 1.3-1.4 2.2-1.4 1.1 0 2 .6 2 1.6 0 2.2-4 1.4-4 3.5 0 .9.8 1.5 1.8 1.5.9 0 1.7-.4 2.1-1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NotesTimelineIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h8l4 4v12a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 20V5.5A1.5 1.5 0 017 4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15 4v4h4M8 12h8M8 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EmailTimelineIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7.5l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ pinned }: { pinned?: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      {pinned ? (
        <>
          <path
            d="M12 3.5l1.8 4.2 4.5.5-3.4 3.1.9 4.5L12 13.9 8.2 15.8l.9-4.5-3.4-3.1 4.5-.5L12 3.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <path
          d="M12 3.5l1.8 4.2 4.5.5-3.4 3.1.9 4.5L12 13.9 8.2 15.8l.9-4.5-3.4-3.1 4.5-.5L12 3.5zM12 14v6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  trailing,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-left"
          aria-expanded={open}
        >
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          <span className={cn("text-muted transition-transform", open ? "rotate-180" : "")}>▾</span>
        </button>
        {trailing}
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function TimelineRail({
  icon,
  isLast,
  children,
}: {
  icon: ReactNode;
  isLast?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      <div className="relative flex w-8 shrink-0 flex-col items-center">
        <span className="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-muted shadow-sm">
          {icon}
        </span>
        {!isLast ? <span className="absolute top-8 bottom-[-1rem] w-px border-l border-dashed border-border" /> : null}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function LinkMeta({ links }: { links: CrmActivityLinks }) {
  return (
    <>
      {links.contactName ? (
        <span className="inline-flex items-center gap-1">
          <MetaIconPerson />
          {links.contactName}
        </span>
      ) : null}
      {links.companyName ? (
        <span className="inline-flex items-center gap-1">
          <MetaIconCompany />
          {links.companyName}
        </span>
      ) : null}
      {links.leadTitle ? (
        <span className="inline-flex items-center gap-1">
          <MetaIconDeal />
          {links.leadTitle}
        </span>
      ) : null}
    </>
  );
}

function formatFromLabel(email: CrmEmailListItem): string {
  return email.fromName?.trim() || email.fromAddress;
}

function formatToLabel(email: CrmEmailListItem): string {
  if (email.toAddresses.length === 0) {
    return "—";
  }
  return email.toAddresses.join(", ");
}

function emailPlainBody(email: CrmEmailListItem): string {
  if (email.bodyText?.trim()) {
    return email.bodyText.trim();
  }
  if (email.bodyHtml?.trim()) {
    return email.bodyHtml
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return email.snippet?.trim() || "";
}

function FocusActivityCard({
  activity,
  links,
  onChanged,
  onEdit,
}: {
  activity: CrmActivityRecord;
  links: CrmActivityLinks;
  onChanged?: () => void;
  onEdit?: (activity: CrmActivityRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overdue = isOverdue(activity);
  const typeLabel = activityTypeLabel(activity.activity_type);
  const noteText =
    activity.notes?.trim() ||
    (activity.subject?.trim() && activity.subject.trim() !== typeLabel
      ? activity.subject.trim()
      : "");

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function markDone() {
    if (busy || activity.completed_at) {
      return;
    }
    setBusy(true);
    setMenuOpen(false);
    try {
      const response = await fetch(`/api/crm/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markDone: true }),
      });
      if (!response.ok) {
        return;
      }
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function deleteActivity() {
    if (busy) {
      return;
    }
    const confirmed = window.confirm(`Delete “${activity.subject || typeLabel}”? This cannot be undone.`);
    if (!confirmed) {
      setMenuOpen(false);
      return;
    }
    setBusy(true);
    setMenuOpen(false);
    try {
      const response = await fetch(`/api/crm/activities/${activity.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        return;
      }
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            title="Mark as done"
            aria-label="Mark as done"
            disabled={busy}
            onClick={() => void markDone()}
            className={cn(
              "group relative mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-border bg-white transition-colors",
              "hover:border-primary hover:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              busy && "opacity-60",
            )}
          >
            <svg
              className="h-2 w-2 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M3.5 8.2l3 3 6-6.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <p className="truncate text-sm font-semibold text-foreground">{typeLabel}</p>
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Activity actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={busy}
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-50"
          >
            <span className="text-lg leading-none tracking-tight">⋯</span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1 min-w-[10.5rem] overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit?.(activity);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-50"
                onClick={() => void markDone()}
              >
                Mark as done
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => void deleteActivity()}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        {overdue ? (
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Overdue
          </span>
        ) : null}
        <span className={cn(overdue && "text-red-600")}>
          {activity.due_at ? formatGridDate(activity.due_at) : "Unscheduled"}
        </span>
        {activity.assignee_name ? <span>{activity.assignee_name}</span> : null}
        <LinkMeta links={links} />
      </div>

      {noteText && !isEmptyNoteHtml(noteText) ? (
        <div className="mt-2 rounded border border-border bg-slate-100 px-2.5 py-1.5">
          {noteText.includes("<") ? <NotesHtml html={noteText} /> : <p className="text-sm text-foreground">{noteText}</p>}
        </div>
      ) : null}
    </div>
  );
}

function EmailHistoryCard({
  email,
  links,
  pinned,
  expandAll,
  onPinnedChange,
}: {
  email: CrmEmailListItem;
  links: CrmActivityLinks;
  pinned?: boolean;
  expandAll?: boolean;
  onPinnedChange?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const plain = emailPlainBody(email);
  const isLong = plain.length > EMAIL_BODY_COLLAPSE_CHARS;
  const showFull = expandAll || expanded || !isLong;
  const preview = isLong && !showFull ? `${plain.slice(0, EMAIL_BODY_COLLAPSE_CHARS).trimEnd()}…` : plain;
  const isPinned = Boolean(pinned ?? email.pinnedAt);

  async function togglePin() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/crm/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !isPinned }),
      });
      if (!response.ok) {
        return;
      }
      onPinnedChange?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isPinned ? "border-amber-200/80 bg-amber-50" : "border-border bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <span>{formatHistoryDateTime(email.messageAt)}</span>
            <span aria-hidden>·</span>
            <span>
              From {formatFromLabel(email)}
              {email.fromName ? ` <${email.fromAddress}>` : ""}
            </span>
            <span aria-hidden>·</span>
            <span>To {formatToLabel(email)}</span>
            <LinkMeta links={links} />
          </div>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            Subject: {email.subject?.trim() || "(no subject)"}
          </p>
        </div>
        <button
          type="button"
          title={isPinned ? "Unpin from Focus" : "Pin to Focus"}
          aria-label={isPinned ? "Unpin from Focus" : "Pin to Focus"}
          disabled={busy}
          onClick={() => void togglePin()}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-foreground disabled:opacity-50",
            isPinned && "text-foreground",
          )}
        >
          <PinIcon pinned={isPinned} />
        </button>
      </div>

      {preview ? (
        <div className="mt-2">
          {email.bodyHtml && showFull && !email.bodyText ? (
            <NotesHtml html={email.bodyHtml} />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">{preview}</p>
          )}
          {isLong && !expandAll ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HistoryEntry({
  item,
  links,
  isLast,
}: {
  item: FocusHistoryItem;
  links: CrmActivityLinks;
  isLast?: boolean;
}) {
  const isNote = item.kind === "note";
  const isActivity = item.kind === "activity";
  const fieldIconId = historyFieldIconId({
    fieldKey: item.fieldKey,
    kind: item.kind === "email" ? undefined : item.kind,
    title: item.title,
  });
  const icon = isNote ? (
    <NotesTimelineIcon />
  ) : isActivity ? (
    <ActivityTypeIcon type="CALL" className="h-3.5 w-3.5" />
  ) : fieldIconId ? (
    <HistoryFieldIcon id={fieldIconId} />
  ) : (
    <span className="h-2.5 w-2.5 rounded-full border border-border bg-white" />
  );

  return (
    <TimelineRail icon={icon} isLast={isLast}>
      {isNote && item.detail ? (
        <div className="rounded-lg border border-border bg-slate-100 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            <span>{formatHistoryDateTime(item.at)}</span>
            {item.actorName ? <span>{item.actorName}</span> : null}
            <LinkMeta links={links} />
          </div>
          <div className="mt-1.5">
            {item.detail.includes("<") ? (
              <NotesHtml html={item.detail} />
            ) : (
              <p className="text-sm text-foreground">{item.detail}</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-foreground">
            <span className="font-medium">{item.title}</span>
            {item.detail ? (
              <>
                {": "}
                <span className="text-foreground">{item.detail}</span>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatHistoryDateTime(item.at)}
            {item.actorName ? ` · ${item.actorName}` : ""}
          </p>
        </div>
      )}
    </TimelineRail>
  );
}

type HistoryRow =
  | { type: "history"; at: string; id: string; item: FocusHistoryItem }
  | { type: "email"; at: string; id: string; email: CrmEmailListItem };

type CrmFocusHistoryProps = {
  links: CrmActivityLinks;
  activities: CrmActivityRecord[];
  history: FocusHistoryItem[];
  emails?: CrmEmailListItem[];
  onActivityChanged?: () => void;
  onEmailsChanged?: () => void;
  onEditActivity?: (activity: CrmActivityRecord) => void;
};

export function CrmFocusHistory({
  links,
  activities,
  history,
  emails = [],
  onActivityChanged,
  onEmailsChanged,
  onEditActivity,
}: CrmFocusHistoryProps) {
  const [focusOpen, setFocusOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterId>("all");
  const [expandAll, setExpandAll] = useState(false);

  const focusActivities = useMemo(
    () =>
      [...activities]
        .filter((activity) => !activity.completed_at)
        .sort((a, b) => {
          const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        }),
    [activities],
  );

  const pinnedEmails = useMemo(
    () =>
      [...emails]
        .filter((email) => Boolean(email.pinnedAt))
        .sort((a, b) => new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime()),
    [emails],
  );

  const noteCount = history.filter((item) => item.kind === "note").length;
  const activityCount = history.filter((item) => item.kind === "activity").length;
  const emailCount = emails.length;

  const visibleRows = useMemo(() => {
    const rows: HistoryRow[] = [];
    if (
      historyFilter === "all" ||
      historyFilter === "notes" ||
      historyFilter === "activities" ||
      historyFilter === "changelog"
    ) {
      for (const item of history) {
        if (historyFilter === "notes" && item.kind !== "note") continue;
        if (historyFilter === "activities" && item.kind !== "activity") continue;
        if (historyFilter === "changelog" && item.kind !== "created" && item.kind !== "change") continue;
        rows.push({ type: "history", at: item.at, id: item.id, item });
      }
    }
    if (historyFilter === "all" || historyFilter === "emails") {
      for (const email of emails) {
        rows.push({ type: "email", at: email.messageAt, id: `email-${email.id}`, email });
      }
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [history, emails, historyFilter]);

  const filters: Array<{ id: HistoryFilterId; label: string }> = [
    { id: "all", label: "All" },
    { id: "activities", label: `Activities (${activityCount})` },
    { id: "notes", label: `Notes (${noteCount})` },
    { id: "emails", label: `Emails (${emailCount})` },
    { id: "changelog", label: "Changelog" },
  ];

  const focusEmpty = focusActivities.length === 0 && pinnedEmails.length === 0;

  return (
    <>
      <CollapsibleSection
        title="Focus"
        open={focusOpen}
        onToggle={() => setFocusOpen((value) => !value)}
        trailing={
          pinnedEmails.length > 0 ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
              <span>Expand all items</span>
              <button
                type="button"
                role="switch"
                aria-checked={expandAll}
                onClick={() => setExpandAll((value) => !value)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  expandAll ? "bg-primary" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    expandAll ? "left-4" : "left-0.5",
                  )}
                />
              </button>
            </label>
          ) : null
        }
      >
        {focusEmpty ? (
          <p className="text-sm text-muted">No open activity.</p>
        ) : (
          <div>
            {pinnedEmails.map((email, index) => (
              <TimelineRail
                key={`pin-${email.id}`}
                isLast={index === pinnedEmails.length - 1 && focusActivities.length === 0}
                icon={<EmailTimelineIcon />}
              >
                <EmailHistoryCard
                  email={email}
                  links={links}
                  pinned
                  expandAll={expandAll}
                  onPinnedChange={onEmailsChanged}
                />
              </TimelineRail>
            ))}
            {focusActivities.map((activity, index) => (
              <TimelineRail
                key={activity.id}
                isLast={index === focusActivities.length - 1}
                icon={<ActivityTypeIcon type={activity.activity_type} className="h-3.5 w-3.5" />}
              >
                <FocusActivityCard
                  activity={activity}
                  links={links}
                  onChanged={onActivityChanged}
                  onEdit={onEditActivity}
                />
              </TimelineRail>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="History"
        open={historyOpen}
        onToggle={() => setHistoryOpen((value) => !value)}
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setHistoryFilter(filter.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                historyFilter === filter.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted hover:bg-slate-100",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <p className="text-sm text-muted">No history yet.</p>
        ) : (
          <div>
            {visibleRows.map((row, index) =>
              row.type === "email" ? (
                <TimelineRail
                  key={row.id}
                  icon={<EmailTimelineIcon />}
                  isLast={index === visibleRows.length - 1}
                >
                  <EmailHistoryCard
                    email={row.email}
                    links={links}
                    onPinnedChange={onEmailsChanged}
                  />
                </TimelineRail>
              ) : (
                <HistoryEntry
                  key={row.id}
                  item={row.item}
                  links={links}
                  isLast={index === visibleRows.length - 1}
                />
              ),
            )}
          </div>
        )}
      </CollapsibleSection>
    </>
  );
}
