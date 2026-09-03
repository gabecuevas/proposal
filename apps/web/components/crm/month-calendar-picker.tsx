"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@repo/ui/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day, 0, 0, 0, 0);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

type MonthCalendarPickerProps = {
  value: string;
  min?: string;
  onChange: (value: string) => void;
};

export function MonthCalendarPicker({ value, min, onChange }: MonthCalendarPickerProps) {
  const selected = useMemo(() => parseDateKey(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const todayKey = toDateKey(new Date());
  const minDate = min ? parseDateKey(min) : null;

  useEffect(() => {
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const startOffset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  return (
    <div className="w-[17.5rem] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
          onClick={() =>
            setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
          }
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-foreground">{monthLabel(visibleMonth)}</p>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
          onClick={() =>
            setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
          }
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-center text-[11px] font-medium text-muted">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const isSelected = key === value;
          const isToday = key === todayKey;
          const disabled = Boolean(minDate && date < minDate);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                "h-8 rounded text-sm",
                !inMonth && "text-muted/50",
                inMonth && !isSelected && "text-foreground hover:bg-slate-100",
                isToday && !isSelected && "font-semibold text-primary",
                isSelected && "bg-primary font-semibold text-primary-foreground",
                disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
