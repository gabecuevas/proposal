"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@repo/ui/utils";
import type { CrmActivityRecord } from "@/lib/crm/activities";
import { activityTypeLabel } from "@/lib/crm/activities";

const HOUR_HEIGHT = 44;

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
};

export function ActivityDayCalendar({ date, activities, timezone }: ActivityDayCalendarProps) {
  const [now, setNow] = useState(() => new Date());

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

  const nowTop = (minutesSinceMidnight(now) / 60) * HOUR_HEIGHT;
  const nowLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(now);

  return (
    <div className="flex h-full min-h-[28rem] flex-col border-l border-border bg-slate-50/60">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-medium text-foreground">{headerLabel}</p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="absolute inset-x-0 border-t border-border/70"
              style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 left-2 bg-slate-50/90 px-1 text-[10px] text-muted">
                {formatHourLabel(hour)}
              </span>
            </div>
          ))}

          {isToday ? (
            <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
              <span className="w-12 shrink-0 pr-1 text-right text-[10px] font-medium text-red-500">{nowLabel}</span>
              <div className="h-px flex-1 bg-red-500" />
            </div>
          ) : null}

          {activities.map((activity) => {
            if (!activity.due_at) {
              return null;
            }
            const start = new Date(activity.due_at);
            const end = activity.end_at ? new Date(activity.end_at) : new Date(start.getTime() + 30 * 60_000);
            const top = (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT;
            const height = Math.max(((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT, 24);
            return (
              <div
                key={activity.id}
                className={cn(
                  "absolute left-12 right-2 z-10 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs",
                  activity.completed_at && "opacity-60",
                )}
                style={{ top, height }}
              >
                <p className="truncate font-medium text-primary">{activity.subject}</p>
                <p className="truncate text-[10px] text-muted">{activityTypeLabel(activity.activity_type)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
