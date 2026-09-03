"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { IconSettings } from "@/components/app-shell/shell-icons";
import {
  ActivitiesWeekCalendar,
  startOfWeekSunday,
} from "@/components/crm/activities-week-calendar";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import { MarkActivityDoneModal } from "@/components/crm/mark-activity-done-modal";
import { MonthCalendarPicker } from "@/components/crm/month-calendar-picker";
import {
  activityTypeLabel,
  CRM_ACTIVITY_TYPES,
  type CrmActivityRecord,
  type CrmActivityType,
} from "@/lib/crm/activity-shared";
import { activityLinkedRecordHref } from "@/lib/crm/activity-links";
import {
  defaultVisibleIds,
  loadGridPrefs,
  saveGridPrefs,
  type GridPrefs,
} from "@/lib/crm/grid-prefs";
import { formatGridDateTime } from "@/lib/ui/datetime";

type WorkspaceMember = {
  userId: string;
  name: string;
  email: string;
};

type ViewMode = "calendar" | "list";
type TypeFilter = "all" | CrmActivityType;
type PeriodFilter = "todo" | "overdue" | "today" | "tomorrow" | "this_week" | "next_week" | "all";

type ActivityListColumn = {
  id: string;
  label: string;
  width: number;
  required?: boolean;
  defaultVisible?: boolean;
  cell: (activity: CrmActivityRecord, tone: "overdue" | "upcoming") => ReactNode;
};

const CHECK_COL_WIDTH = 42;
const DONE_COL_WIDTH = 56;
const ACTION_COL_WIDTH = 44;
const LIST_STORAGE_KEY = "crm-activities-list-columns-v1";

function isActivityOverdue(activity: CrmActivityRecord, now = Date.now()): boolean {
  return Boolean(
    !activity.completed_at && activity.due_at && new Date(activity.due_at).getTime() < now,
  );
}

function activityTone(activity: CrmActivityRecord): "overdue" | "upcoming" {
  return isActivityOverdue(activity) ? "overdue" : "upcoming";
}

function toneClass(tone: "overdue" | "upcoming"): string {
  return tone === "overdue" ? "text-red-600" : "text-emerald-600";
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodBounds(period: PeriodFilter, now = new Date()): { from: Date; to: Date } | null {
  const today = startOfLocalDay(now);
  if (period === "all") {
    return null;
  }
  if (period === "todo" || period === "overdue") {
    return { from: addDays(today, -365), to: addDays(today, 365) };
  }
  if (period === "today") {
    return { from: today, to: addDays(today, 1) };
  }
  if (period === "tomorrow") {
    return { from: addDays(today, 1), to: addDays(today, 2) };
  }
  if (period === "this_week") {
    const start = startOfWeekSunday(today);
    return { from: start, to: addDays(start, 7) };
  }
  if (period === "next_week") {
    const start = addDays(startOfWeekSunday(today), 7);
    return { from: start, to: addDays(start, 7) };
  }
  return null;
}

function matchesPeriod(activity: CrmActivityRecord, period: PeriodFilter, now = new Date()): boolean {
  if (period === "all") {
    return true;
  }
  if (!activity.due_at) {
    return period === "todo";
  }
  const due = new Date(activity.due_at);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const today = startOfLocalDay(now);
  const tomorrow = addDays(today, 1);
  if (period === "todo") {
    return !activity.completed_at;
  }
  if (period === "overdue") {
    return !activity.completed_at && due < now;
  }
  if (period === "today") {
    return due >= today && due < tomorrow;
  }
  if (period === "tomorrow") {
    return due >= tomorrow && due < addDays(tomorrow, 1);
  }
  if (period === "this_week") {
    const start = startOfWeekSunday(today);
    return due >= start && due < addDays(start, 7);
  }
  if (period === "next_week") {
    const start = addDays(startOfWeekSunday(today), 7);
    return due >= start && due < addDays(start, 7);
  }
  return true;
}

export default function ContactsCalendarPage() {
  const [view, setView] = useState<ViewMode>("calendar");
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("todo");
  const [activities, setActivities] = useState<CrmActivityRecord[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [error, setError] = useState("");
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const [markDoneTarget, setMarkDoneTarget] = useState<CrmActivityRecord | null>(null);
  const [markDoneSaving, setMarkDoneSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const columnPickerId = useId();

  const listColumns = useMemo<ActivityListColumn[]>(
    () => [
      {
        id: "type",
        label: "Type",
        width: 160,
        required: true,
        cell: (activity, tone) => {
          const href = activityLinkedRecordHref(activity);
          const content = (
            <span className={cn("inline-flex items-center gap-1.5 font-bold", toneClass(tone))}>
              <ActivityTypeIcon type={activity.activity_type} className="h-3.5 w-3.5" />
              {activityTypeLabel(activity.activity_type)}
            </span>
          );
          return href ? (
            <Link href={href} className="hover:underline" onClick={(event) => event.stopPropagation()}>
              {content}
            </Link>
          ) : (
            content
          );
        },
      },
      {
        id: "contact",
        label: "Contact person",
        width: 160,
        cell: (activity) =>
          activity.contact_name ? (
            activity.contact_id || activity.lead_id ? (
              <Link
                href={
                  activity.lead_id
                    ? `/app/contacts/leads?open=${encodeURIComponent(activity.lead_id)}`
                    : `/app/contacts/people?open=${encodeURIComponent(activity.contact_id!)}`
                }
                className="inline-flex rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs text-foreground hover:bg-slate-100"
                onClick={(event) => event.stopPropagation()}
              >
                {activity.contact_name}
              </Link>
            ) : (
              <span className="inline-flex rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs text-foreground">
                {activity.contact_name}
              </span>
            )
          ) : (
            "—"
          ),
      },
      {
        id: "email",
        label: "Email",
        width: 200,
        cell: (activity) => activity.contact_email || "—",
      },
      {
        id: "phone",
        label: "Phone",
        width: 150,
        cell: (activity) => activity.contact_phone || "—",
      },
      {
        id: "company",
        label: "Company",
        width: 180,
        cell: (activity) =>
          activity.company_name ? (
            activity.company_id ? (
              <Link
                href={`/app/contacts/companies?open=${encodeURIComponent(activity.company_id)}`}
                className="font-medium text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {activity.company_name}
              </Link>
            ) : (
              <span className="font-medium text-primary">{activity.company_name}</span>
            )
          ) : (
            "—"
          ),
      },
      {
        id: "assignee",
        label: "Assigned to User",
        width: 170,
        cell: (activity) => activity.assignee_name || "—",
      },
      {
        id: "due_date",
        label: "Due date",
        width: 170,
        cell: (activity, tone) => (
          <span className={cn("font-medium", toneClass(tone))}>
            {activity.due_at ? formatGridDateTime(activity.due_at) : "—"}
          </span>
        ),
      },
      {
        id: "priority",
        label: "Priority",
        width: 110,
        defaultVisible: false,
        cell: (activity) =>
          activity.priority
            ? activity.priority.charAt(0) + activity.priority.slice(1).toLowerCase()
            : "—",
      },
    ],
    [],
  );

  const [columnPrefs, setColumnPrefs] = useState<GridPrefs>(() =>
    loadGridPrefs(LIST_STORAGE_KEY, listColumns),
  );

  useEffect(() => {
    setColumnPrefs(loadGridPrefs(LIST_STORAGE_KEY, listColumns));
  }, [listColumns]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  const visibleListColumns = useMemo(() => {
    const order = columnPrefs.visible.filter((id) => listColumns.some((column) => column.id === id));
    return order
      .map((id) => listColumns.find((column) => column.id === id))
      .filter((column): column is ActivityListColumn => Boolean(column));
  }, [columnPrefs.visible, listColumns]);

  const tableMinWidth =
    CHECK_COL_WIDTH +
    DONE_COL_WIDTH +
    ACTION_COL_WIDTH +
    visibleListColumns.reduce((sum, column) => sum + column.width, 0);

  function toggleListColumn(id: string, required?: boolean) {
    if (required) {
      return;
    }
    const visible = columnPrefs.visible.includes(id)
      ? columnPrefs.visible.filter((item) => item !== id)
      : [...columnPrefs.visible, id];
    if (visible.length === 0) {
      return;
    }
    const next = { ...columnPrefs, visible };
    setColumnPrefs(next);
    saveGridPrefs(LIST_STORAGE_KEY, next);
  }

  function resetListColumns() {
    const next = {
      ...columnPrefs,
      visible: defaultVisibleIds(listColumns),
      widths: {},
      sort: null,
    };
    setColumnPrefs(next);
    saveGridPrefs(LIST_STORAGE_KEY, next);
  }

  useEffect(() => {
    void (async () => {
      const [sessionRes, membersRes] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/workspace/members"),
      ]);
      if (sessionRes.ok) {
        const payload = (await sessionRes.json()) as { user?: { userId: string } | null };
        if (payload.user?.userId) {
          setCurrentUserId(payload.user.userId);
          setAssigneeUserId(payload.user.userId);
        }
      }
      if (membersRes.ok) {
        const payload = (await membersRes.json()) as {
          members: Array<{ userId: string; name: string; email: string }>;
        };
        setMembers(payload.members);
      }
    })();
  }, []);

  useEffect(() => {
    if (!weekPickerOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!weekPickerRef.current?.contains(event.target as Node)) {
        setWeekPickerOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setWeekPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [weekPickerOpen]);

  const loadRange = useCallback(async () => {
    if (!assigneeUserId) {
      return;
    }
    setError("");
    try {
      let from: Date;
      let to: Date;
      let openOnly = false;
      if (view === "calendar") {
        from = weekStart;
        to = addDays(weekStart, 7);
        openOnly = true;
      } else {
        const bounds = periodBounds(periodFilter);
        from = bounds?.from ?? addDays(startOfLocalDay(new Date()), -30);
        to = bounds?.to ?? addDays(startOfLocalDay(new Date()), 60);
        openOnly = periodFilter === "todo" || periodFilter === "overdue";
      }
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        assigneeUserId,
      });
      if (openOnly) {
        params.set("openOnly", "1");
      }
      const response = await fetch(`/api/crm/activities?${params.toString()}`);
      if (!response.ok) {
        setError("Failed to load activities.");
        return;
      }
      const payload = (await response.json()) as { activities?: CrmActivityRecord[] };
      setActivities(payload.activities ?? []);
    } catch {
      setError("Failed to load activities.");
    }
  }, [assigneeUserId, periodFilter, view, weekStart]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const filtered = useMemo(() => {
    return activities.filter((activity) => {
      if (typeFilter !== "all" && activity.activity_type !== typeFilter) {
        return false;
      }
      if (view === "list" && !matchesPeriod(activity, periodFilter)) {
        return false;
      }
      return true;
    });
  }, [activities, periodFilter, typeFilter, view]);

  async function confirmMarkDone() {
    if (!markDoneTarget) {
      return;
    }
    setMarkDoneSaving(true);
    try {
      const response = await fetch(`/api/crm/activities/${markDoneTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markDone: true }),
      });
      if (!response.ok) {
        setError("Failed to mark activity as done.");
        return;
      }
      setMarkDoneTarget(null);
      await loadRange();
    } finally {
      setMarkDoneSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const typeFilters: Array<{ id: TypeFilter; label: string }> = [
    { id: "all", label: "All" },
    ...CRM_ACTIVITY_TYPES.map((type) => ({ id: type as TypeFilter, label: activityTypeLabel(type) })),
  ];

  const periodFilters: Array<{ id: PeriodFilter; label: string }> = [
    { id: "todo", label: "To-do" },
    { id: "overdue", label: "Overdue" },
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
    { id: "this_week", label: "This week" },
    { id: "next_week", label: "Next week" },
  ];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Activities</h1>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
              title="Calendar and list views for CRM activities"
            >
              i
            </span>
          </div>
          <div className="inline-flex rounded-md border border-border bg-white p-0.5">
            <button
              type="button"
              title="List view"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted hover:bg-slate-50",
              )}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              title="Calendar view"
              aria-label="Calendar view"
              onClick={() => setView("calendar")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded",
                view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted hover:bg-slate-50",
              )}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "calendar" ? (
            <>
              <div ref={weekPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setWeekPickerOpen((open) => !open)}
                  aria-haspopup="dialog"
                  aria-expanded={weekPickerOpen}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
                >
                  <span>{formatWeekRange(weekStart)}</span>
                  <span className="text-muted">▾</span>
                </button>
                {weekPickerOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-1 rounded-md border border-border bg-white shadow-lg">
                    <MonthCalendarPicker
                      value={toDateKey(weekStart)}
                      onChange={(next) => {
                        const [year, month, day] = next.split("-").map(Number);
                        setWeekStart(startOfWeekSunday(new Date(year!, month! - 1, day)));
                        setWeekPickerOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="inline-flex items-center rounded-md border border-border bg-white">
                <button
                  type="button"
                  className="px-2 py-1.5 text-sm text-muted hover:bg-slate-50"
                  onClick={() => setWeekStart((value) => addDays(value, -7))}
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="border-x border-border px-2.5 py-1.5 text-sm text-foreground hover:bg-slate-50"
                  onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 text-sm text-muted hover:bg-slate-50"
                  onClick={() => setWeekStart((value) => addDays(value, 7))}
                  aria-label="Next week"
                >
                  ›
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{filtered.length} activities</p>
          )}

          <select
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={assigneeUserId}
            onChange={(event) => setAssigneeUserId(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? `${member.name} (You)` : member.name}
              </option>
            ))}
          </select>

          <Link
            href="/app/settings/integrations/calendar"
            className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 hover:bg-red-100"
          >
            Sync inactive
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex flex-wrap gap-1">
          {typeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setTypeFilter(filter.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium",
                typeFilter === filter.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-foreground hover:bg-slate-50",
              )}
            >
              {filter.id !== "all" ? (
                <ActivityTypeIcon type={filter.id} className="h-3.5 w-3.5" />
              ) : null}
              {filter.label}
            </button>
          ))}
        </div>

        {view === "list" ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {periodFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setPeriodFilter(filter.id)}
                className={cn(
                  periodFilter === filter.id ? "font-semibold text-primary" : "text-muted hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="shrink-0 px-4 py-2 text-sm text-red-600">{error}</p> : null}

      {view === "calendar" ? (
        <ActivitiesWeekCalendar
          weekStart={weekStart}
          activities={filtered}
          onRequestMarkDone={setMarkDoneTarget}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table
            className="w-full border-collapse text-left text-sm"
            style={{ minWidth: `max(100%, ${tableMinWidth}px)` }}
          >
            <thead>
              <tr className="bg-slate-50 text-[13px] font-semibold text-foreground">
                <th
                  className="sticky left-0 z-20 border-b border-r border-border bg-slate-50 px-2"
                  style={{ width: CHECK_COL_WIDTH, minWidth: CHECK_COL_WIDTH }}
                >
                  <span className="sr-only">Select</span>
                </th>
                <th
                  className="border-b border-r border-border px-2"
                  style={{ width: DONE_COL_WIDTH, minWidth: DONE_COL_WIDTH }}
                >
                  <span className="flex h-10 items-center justify-center">Done</span>
                </th>
                {visibleListColumns.map((column) => (
                  <th
                    key={column.id}
                    className="border-b border-r border-border px-0"
                    style={{ width: column.width, minWidth: column.width }}
                  >
                    <span className="flex h-10 items-center px-3">{column.label}</span>
                  </th>
                ))}
                <th className="border-b border-border bg-slate-50" aria-hidden />
                <th
                  className="sticky right-0 z-20 border-b border-l border-border bg-slate-50 px-1"
                  style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                >
                  <div ref={pickerRef} className="relative flex justify-center">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={pickerOpen}
                      aria-controls={columnPickerId}
                      aria-label="Choose columns"
                      onClick={() => setPickerOpen((open) => !open)}
                      className="rounded p-1 text-muted hover:bg-slate-100 hover:text-foreground"
                    >
                      <IconSettings className="h-4 w-4" />
                    </button>
                    {pickerOpen ? (
                      <div
                        id={columnPickerId}
                        role="menu"
                        className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-border bg-surface py-2 shadow-lg"
                      >
                        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Columns
                        </p>
                        <ul className="max-h-72 overflow-y-auto">
                          {listColumns.map((column) => {
                            const checked = columnPrefs.visible.includes(column.id);
                            return (
                              <li key={column.id}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={column.required}
                                    onChange={() => toggleListColumn(column.id, column.required)}
                                    className="h-3.5 w-3.5 accent-primary"
                                  />
                                  <span>{column.label}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        <button
                          type="button"
                          onClick={resetListColumns}
                          className="mt-1 w-full border-t border-border px-3 pt-2 text-left text-sm text-primary hover:bg-slate-50"
                        >
                          Reset columns
                        </button>
                      </div>
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleListColumns.length + 3}
                    className="px-4 py-10 text-center text-muted"
                  >
                    No activities in this view.
                  </td>
                </tr>
              ) : (
                filtered.map((activity) => {
                  const tone = activityTone(activity);
                  return (
                    <tr key={activity.id} className="group border-b border-border hover:bg-slate-50/80">
                      <td
                        className="sticky left-0 z-10 border-r border-border bg-surface px-2 group-hover:bg-slate-50/80"
                        style={{ width: CHECK_COL_WIDTH, minWidth: CHECK_COL_WIDTH }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(activity.id)}
                          onChange={() => toggleSelected(activity.id)}
                          aria-label={`Select ${activity.subject}`}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                      </td>
                      <td
                        className="border-r border-border px-2"
                        style={{ width: DONE_COL_WIDTH, minWidth: DONE_COL_WIDTH }}
                      >
                        <div className="flex h-10 items-center justify-center">
                          <button
                            type="button"
                            title="Mark as done"
                            aria-label="Mark as done"
                            onClick={() => setMarkDoneTarget(activity)}
                            className={cn(
                              "group/mark flex h-4 w-4 items-center justify-center rounded-full border border-border bg-white transition-colors",
                              "hover:border-primary hover:bg-primary",
                            )}
                          >
                            <svg
                              className="h-2 w-2 text-primary-foreground opacity-0 group-hover/mark:opacity-100"
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
                        </div>
                      </td>
                      {visibleListColumns.map((column) => (
                        <td
                          key={column.id}
                          className="truncate border-r border-border px-3 py-2.5 text-muted"
                          style={{ width: column.width, maxWidth: column.width }}
                        >
                          {column.cell(activity, tone)}
                        </td>
                      ))}
                      <td className="border-border" aria-hidden />
                      <td
                        className="sticky right-0 z-10 border-l border-border bg-surface px-1 group-hover:bg-slate-50/80"
                        style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                      />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {markDoneTarget ? (
        <MarkActivityDoneModal
          activity={markDoneTarget}
          confirming={markDoneSaving}
          onCancel={() => {
            if (!markDoneSaving) {
              setMarkDoneTarget(null);
            }
          }}
          onConfirm={() => void confirmMarkDone()}
        />
      ) : null}
    </div>
  );
}
