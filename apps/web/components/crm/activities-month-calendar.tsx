"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@repo/ui/utils";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import { activityTypeLabel, type CrmActivityRecord } from "@/lib/crm/activity-shared";
import { activityLinkedRecordHref } from "@/lib/crm/activity-links";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isGoogleCalendarActivity(activity: CrmActivityRecord): boolean {
  return activity.id.startsWith("gcal:");
}

export function monthGridStart(anchor: Date): Date {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return addDays(first, -first.getDay());
}

export function monthGridDays(anchor: Date): Date[] {
  const start = monthGridStart(anchor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

type ActivitiesMonthCalendarProps = {
  monthAnchor: Date;
  activities: CrmActivityRecord[];
  onSelectDay?: (day: Date) => void;
  onRequestMarkDone?: (activity: CrmActivityRecord) => void;
  myCalendarEventColor?: string | null;
};

export function ActivitiesMonthCalendar({
  monthAnchor,
  activities,
  onSelectDay,
  onRequestMarkDone,
  myCalendarEventColor,
}: ActivitiesMonthCalendarProps) {
  const [now] = useState(() => new Date());
  const days = useMemo(() => monthGridDays(monthAnchor), [monthAnchor]);
  const monthIndex = monthAnchor.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, CrmActivityRecord[]>();
    for (const day of days) {
      map.set(toDateKey(day), []);
    }
    for (const activity of activities) {
      if (!activity.due_at) {
        continue;
      }
      const due = new Date(activity.due_at);
      if (Number.isNaN(due.getTime())) {
        continue;
      }
      const key = toDateKey(due);
      const list = map.get(key);
      if (list) {
        list.push(activity);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : 0;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : 0;
        return aDue - bDue;
      });
    }
    return map;
  }, [activities, days]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-white">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="flex h-9 items-center justify-center border-r border-border text-xs font-bold uppercase text-muted last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid min-h-full grid-cols-7 grid-rows-6">
          {days.map((day) => {
            const key = toDateKey(day);
            const items = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === monthIndex;
            const isToday = sameLocalDay(day, now);
            const visible = items.slice(0, MAX_VISIBLE);
            const overflow = items.length - visible.length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay?.(startOfLocalDay(day))}
                className={cn(
                  "flex min-h-[6.5rem] flex-col gap-0.5 border-b border-r border-border p-1.5 text-left align-top last:border-r-0 hover:bg-slate-50/80",
                  !inMonth && "bg-slate-50/50",
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 inline-flex h-6 w-6 items-center justify-center text-xs font-semibold",
                    isToday
                      ? "rounded-full bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted",
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {visible.map((activity) => {
                    const href = activityLinkedRecordHref(activity);
                    const label = activity.subject || activityTypeLabel(activity.activity_type);
                    const accent = isGoogleCalendarActivity(activity) ? myCalendarEventColor : null;
                    const chip = (
                      <span
                        className={cn(
                          "flex min-w-0 items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold",
                          accent ? "" : "bg-sky-50 text-sky-950",
                        )}
                        style={
                          accent
                            ? {
                                backgroundColor: `color-mix(in srgb, ${accent} 14%, white)`,
                                color: `color-mix(in srgb, ${accent} 72%, black)`,
                              }
                            : undefined
                        }
                        title={label}
                      >
                        <ActivityTypeIcon type={activity.activity_type} className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </span>
                    );
                    return href ? (
                      <Link
                        key={activity.id}
                        href={href}
                        className="min-w-0 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {chip}
                      </Link>
                    ) : (
                      <div
                        key={activity.id}
                        className="min-w-0"
                        onClick={(event) => {
                          if (onRequestMarkDone && !isGoogleCalendarActivity(activity)) {
                            event.stopPropagation();
                            onRequestMarkDone(activity);
                          }
                        }}
                      >
                        {chip}
                      </div>
                    );
                  })}
                  {overflow > 0 ? (
                    <span className="px-1 text-[10px] font-medium text-muted">+{overflow} more</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
