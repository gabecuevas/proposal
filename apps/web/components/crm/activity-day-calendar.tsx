"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { activityTypeLabel, type CrmActivityRecord } from "@/lib/crm/activity-shared";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";

const HOUR_HEIGHT = 44;
const GUTTER_WIDTH = 58;

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

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

type ActivityDayCalendarProps = {
  date: Date;
  activities: CrmActivityRecord[];
  timezone: string;
  draftId?: string;
};

export function ActivityDayCalendar({ date, activities, timezone, draftId }: ActivityDayCalendarProps) {
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const headerLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: timezone,
      }).format(date),
    [date, timezone],
  );

  const isToday = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    });
    return formatter.format(date) === formatter.format(now);
  }, [date, now, timezone]);

  const focusTop = useMemo(() => {
    const draft = draftId ? activities.find((item) => item.id === draftId && item.due_at) : null;
    if (draft?.due_at) {
      return (minutesSinceMidnight(new Date(draft.due_at)) / 60) * HOUR_HEIGHT;
    }
    if (isToday) {
      return (minutesSinceMidnight(now) / 60) * HOUR_HEIGHT;
    }
    const first = activities.find((item) => item.due_at && item.id !== draftId);
    if (first?.due_at) {
      return (minutesSinceMidnight(new Date(first.due_at)) / 60) * HOUR_HEIGHT;
    }
    return 9 * HOUR_HEIGHT;
  }, [activities, draftId, isToday, now]);

  useEffect(() => {
    didScrollRef.current = false;
  }, [date]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    const target = Math.max(focusTop - node.clientHeight * 0.35, 0);
    if (!didScrollRef.current) {
      node.scrollTop = target;
      didScrollRef.current = true;
      return;
    }
    node.scrollTo({ top: target, behavior: "smooth" });
  }, [focusTop]);

  const nowTop = (minutesSinceMidnight(now) / 60) * HOUR_HEIGHT;
  const nowLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(now);

  const visibleActivities = useMemo(() => {
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(date);
    return activities.filter((activity) => {
      if (!activity.due_at) {
        return false;
      }
      const start = new Date(activity.due_at);
      const end = activity.end_at ? new Date(activity.end_at) : new Date(start.getTime() + 30 * 60_000);
      const startKey = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
      }).format(start);
      const endKey = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
      }).format(end);
      return startKey <= dayKey && endKey >= dayKey;
    });
  }, [activities, date, timezone]);

  return (
    <div className="flex h-full min-h-[28rem] flex-col border-l border-border bg-slate-50/60">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-medium text-foreground">{headerLabel}</p>
      </div>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="absolute inset-x-0 border-t border-border/70"
              style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 left-1 whitespace-nowrap bg-slate-50/90 px-1 text-[10px] text-muted">
                {formatHourLabel(hour)}
              </span>
            </div>
          ))}

          {isToday ? (
            <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
              <span
                className="shrink-0 whitespace-nowrap pr-1 text-right text-[10px] font-medium leading-none text-red-500"
                style={{ width: GUTTER_WIDTH }}
              >
                {nowLabel}
              </span>
              <div className="h-px flex-1 bg-red-500" />
            </div>
          ) : null}

          {visibleActivities.map((activity) => {
            if (!activity.due_at) {
              return null;
            }
            const start = new Date(activity.due_at);
            const end = activity.end_at ? new Date(activity.end_at) : new Date(start.getTime() + 30 * 60_000);
            const top = (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT;
            const height = Math.max(((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT, 24);
            const isDraft = Boolean(draftId && activity.id === draftId);
            return (
              <div
                key={activity.id}
                className={cn(
                  "absolute right-2 z-10 overflow-hidden rounded px-2 py-1 text-xs text-primary-foreground",
                  isDraft ? "border border-dashed border-white/50 bg-primary/85" : "bg-primary",
                  activity.completed_at && "opacity-60",
                )}
                style={{ top, height, left: GUTTER_WIDTH }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <ActivityTypeIcon type={activity.activity_type} className="h-3.5 w-3.5 shrink-0" />
                  <p className="truncate font-semibold text-primary-foreground">{activity.subject}</p>
                </div>
                {height >= 36 ? (
                  <p className="truncate pl-5 text-[10px] text-primary-foreground/80">
                    {activityTypeLabel(activity.activity_type)}
                    {isDraft ? " · Draft" : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
