"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import type { CrmActivityLinks } from "@/components/crm/activity-panel";
import {
  activityTypeLabel,
  type CrmActivityRecord,
} from "@/lib/crm/activity-shared";
import { formatGridDate, formatGridDateTime } from "@/lib/ui/datetime";
import { NotesHtml } from "@/components/crm/notes-html";
import { isEmptyNoteHtml } from "@/lib/crm/notes-html";

export type FocusHistoryItem = {
  id: string;
  title: string;
  at: string;
  detail?: string;
  kind?: "note" | "created" | "change" | "activity";
  actorName?: string;
};

type HistoryFilterId =
  | "all"
  | "activities"
  | "notes"
  | "changelog";

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

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 text-left"
        aria-expanded={open}
      >
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <span className={cn("text-muted transition-transform", open ? "rotate-180" : "")}>▾</span>
      </button>
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
  const icon = isNote ? (
    <NotesTimelineIcon />
  ) : isActivity ? (
    <ActivityTypeIcon type="CALL" className="h-3.5 w-3.5" />
  ) : (
    <span className="h-2.5 w-2.5 rounded-full border border-border bg-white" />
  );

  return (
    <TimelineRail icon={icon} isLast={isLast}>
      {isNote && item.detail ? (
        <div className="rounded-lg border border-border bg-slate-100 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            <span>{formatGridDateTime(item.at)}</span>
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
            {formatGridDateTime(item.at)}
            {item.actorName ? ` · ${item.actorName}` : ""}
          </p>
        </div>
      )}
    </TimelineRail>
  );
}

type CrmFocusHistoryProps = {
  links: CrmActivityLinks;
  activities: CrmActivityRecord[];
  history: FocusHistoryItem[];
  onActivityChanged?: () => void;
  onEditActivity?: (activity: CrmActivityRecord) => void;
};

export function CrmFocusHistory({
  links,
  activities,
  history,
  onActivityChanged,
  onEditActivity,
}: CrmFocusHistoryProps) {
  const [focusOpen, setFocusOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterId>("all");

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

  const noteCount = history.filter((item) => item.kind === "note").length;
  const activityCount = history.filter((item) => item.kind === "activity").length;

  const visibleHistory = useMemo(() => {
    return history.filter((item) => {
      if (historyFilter === "notes") {
        return item.kind === "note";
      }
      if (historyFilter === "activities") {
        return item.kind === "activity";
      }
      if (historyFilter === "changelog") {
        return item.kind === "created" || item.kind === "change";
      }
      return true;
    });
  }, [history, historyFilter]);

  const filters: Array<{ id: HistoryFilterId; label: string }> = [
    { id: "all", label: "All" },
    { id: "activities", label: `Activities (${activityCount})` },
    { id: "notes", label: `Notes (${noteCount})` },
    { id: "changelog", label: "Changelog" },
  ];

  return (
    <>
      <CollapsibleSection title="Focus" open={focusOpen} onToggle={() => setFocusOpen((value) => !value)}>
        {focusActivities.length === 0 ? (
          <p className="text-sm text-muted">No open activity.</p>
        ) : (
          <div>
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

        {visibleHistory.length === 0 ? (
          <p className="text-sm text-muted">No history yet.</p>
        ) : (
          <div>
            {visibleHistory.map((item, index) => (
              <HistoryEntry
                key={item.id}
                item={item}
                links={links}
                isLast={index === visibleHistory.length - 1}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </>
  );
}
