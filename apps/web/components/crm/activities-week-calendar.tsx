"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import { activityTypeLabel, type CrmActivityRecord } from "@/lib/crm/activity-shared";
import { activityLinkedRecordHref } from "@/lib/crm/activity-links";

const HOUR_HEIGHT = 48;
const GUTTER_WIDTH = 56;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function formatHourLabel(hour: number): string {
  if (hour === 0) {
    return "12 AM";
  }
  if (hour < 12) {
    return `${hour} AM`;
  }
  if (hour === 12) {
    return "12 PM";
  }
  return `${hour - 12} PM`;
}

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

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isUntimed(activity: CrmActivityRecord): boolean {
  if (!activity.due_at) {
    return true;
  }
  const due = new Date(activity.due_at);
  const end = activity.end_at ? new Date(activity.end_at) : null;
  if (Number.isNaN(due.getTime())) {
    return true;
  }
  if (!end || Number.isNaN(end.getTime())) {
    return due.getHours() === 0 && due.getMinutes() === 0;
  }
  const durationMinutes = (end.getTime() - due.getTime()) / 60_000;
  return due.getHours() === 0 && due.getMinutes() === 0 && durationMinutes >= 23 * 60;
}

function monthAbbrev(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
}

function weekdayAbbrev(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function startOfWeekSunday(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function weekDaysFrom(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

type ActivitiesWeekCalendarProps = {
  weekStart: Date;
  activities: CrmActivityRecord[];
  onRequestMarkDone?: (activity: CrmActivityRecord) => void;
};

function ActivityChip({
  activity,
  dense,
  onRequestMarkDone,
}: {
  activity: CrmActivityRecord;
  dense?: boolean;
  onRequestMarkDone?: (activity: CrmActivityRecord) => void;
}) {
  const href = activityLinkedRecordHref(activity);
  const label = activity.subject || activityTypeLabel(activity.activity_type);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded border border-sky-200 bg-sky-50 text-left text-[11px] text-sky-950",
        dense ? "px-1.5 py-0.5" : "px-1.5 py-1",
      )}
      title={label}
    >
      {href ? (
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-1 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          <ActivityTypeIcon type={activity.activity_type} className="h-3 w-3 shrink-0 text-sky-800" />
          <span className="min-w-0 flex-1 truncate font-bold">{label}</span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <ActivityTypeIcon type={activity.activity_type} className="h-3 w-3 shrink-0 text-sky-800" />
          <span className="min-w-0 flex-1 truncate font-bold">{label}</span>
        </span>
      )}
      <button
        type="button"
        title="Mark as done"
        aria-label="Mark as done"
        className={cn(
          "flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-white transition-colors",
          "hover:border-primary hover:bg-primary",
          "group/mark",
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRequestMarkDone?.(activity);
        }}
      >
        <svg
          className="h-1.5 w-1.5 text-primary-foreground opacity-0 group-hover/mark:opacity-100"
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
  );
}

export function ActivitiesWeekCalendar({
  weekStart,
  activities,
  onRequestMarkDone,
}: ActivitiesWeekCalendarProps) {
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  const days = useMemo(() => weekDaysFrom(weekStart), [weekStart]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    if (didScrollRef.current) {
      return;
    }
    didScrollRef.current = true;
    const focusHour = days.some((day) => sameLocalDay(day, now))
      ? Math.max(0, now.getHours() - 1)
      : 8;
    // Offset past sticky header + all-day band roughly.
    scrollRef.current.scrollTop = 72 + focusHour * HOUR_HEIGHT;
  }, [days, now]);

  const byDay = useMemo(() => {
    return days.map((day) => {
      const dayStart = startOfLocalDay(day);
      const dayEnd = addDays(dayStart, 1);
      const dayActivities = activities.filter((activity) => {
        if (!activity.due_at) {
          return false;
        }
        const due = new Date(activity.due_at);
        const end = activity.end_at ? new Date(activity.end_at) : null;
        if (Number.isNaN(due.getTime())) {
          return false;
        }
        if (due >= dayStart && due < dayEnd) {
          return true;
        }
        if (end && !Number.isNaN(end.getTime()) && due < dayStart && end > dayStart) {
          return true;
        }
        return false;
      });
      return {
        day,
        untimed: dayActivities.filter(isUntimed),
        timed: dayActivities.filter((activity) => !isUntimed(activity)),
      };
    });
  }, [activities, days]);

  const nowTop = (minutesSinceMidnight(now) / 60) * HOUR_HEIGHT;
  const showNow = days.some((day) => sameLocalDay(day, now));

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-white">
      <div
        className="sticky top-0 z-30 grid border-b border-border bg-white"
        style={{ gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="flex h-8 items-center border-r border-border px-2">
          <p className="text-sm font-bold uppercase text-foreground">{monthAbbrev(weekStart)}</p>
        </div>
        {days.map((day) => {
          const isToday = sameLocalDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className="flex h-8 items-center justify-center gap-1 border-r border-border px-1 last:border-r-0"
            >
              <span className="whitespace-nowrap text-sm font-bold text-foreground">
                {weekdayAbbrev(day)}
              </span>
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center text-sm font-bold",
                  isToday
                    ? "rounded-full bg-primary text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="grid border-b border-border bg-slate-50/70"
        style={{ gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="border-r border-border px-1 py-2 text-[10px] font-semibold text-muted">All day</div>
        {byDay.map(({ day, untimed }) => (
          <div key={`allday-${day.toISOString()}`} className="min-h-10 space-y-1 border-r border-border p-1 last:border-r-0">
            {untimed.map((activity) => (
              <ActivityChip key={activity.id} activity={activity} dense onRequestMarkDone={onRequestMarkDone} />
            ))}
          </div>
        ))}
      </div>

      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))`,
          height: 24 * HOUR_HEIGHT,
        }}
      >
        <div className="relative border-r border-border">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[10px] text-muted"
              style={{ top: hour * HOUR_HEIGHT }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {byDay.map(({ day, timed }) => (
          <div key={`col-${day.toISOString()}`} className="relative border-r border-border last:border-r-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border/70"
                style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              />
            ))}
            {timed.map((activity) => {
              const due = new Date(activity.due_at!);
              const end = activity.end_at ? new Date(activity.end_at) : new Date(due.getTime() + 30 * 60_000);
              const startMinutes = Math.max(0, minutesSinceMidnight(due));
              const endMinutes = Math.min(24 * 60, minutesSinceMidnight(end) || startMinutes + 30);
              const top = (startMinutes / 60) * HOUR_HEIGHT;
              const height = Math.max(22, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
              return (
                <div key={activity.id} className="absolute inset-x-1 z-10" style={{ top, height }}>
                  <ActivityChip activity={activity} onRequestMarkDone={onRequestMarkDone} />
                </div>
              );
            })}
          </div>
        ))}

        {showNow ? (
          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: GUTTER_WIDTH,
              right: 0,
              top: nowTop,
            }}
          >
            <div className="relative h-px bg-red-500">
              <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
