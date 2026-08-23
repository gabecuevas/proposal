import type { ReactNode } from "react";
import type { DashboardSeriesPoint } from "@/lib/dashboard/types";

/** Rounds the axis maximum up to a readable step so gridline labels stay tidy. */
function niceScale(maxValue: number): { max: number; ticks: number[] } {
  const safeMax = Math.max(1, maxValue);
  const roughStep = safeMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const max = Math.ceil(safeMax / step) * step;

  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 1000; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { max, ticks };
}

function formatMonthLabel(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  const year = String(date.getUTCFullYear()).slice(2);
  return `${month} '${year}`;
}

/**
 * Roughly one label per quarter. Stops a full stride short of the end so the
 * final label has room to render without being clipped.
 */
function labelIndexes(length: number): Set<number> {
  const stride = Math.max(1, Math.round(length / 10));
  const indexes = new Set<number>();
  for (let index = 0; index + stride <= length; index += stride) {
    indexes.add(index);
  }
  return indexes;
}

type BarChartPanelProps = {
  title: string;
  icon: ReactNode;
  points: DashboardSeriesPoint[];
};

export function BarChartPanel({ title, icon, points }: BarChartPanelProps) {
  const { max, ticks } = niceScale(Math.max(0, ...points.map((point) => point.count)));
  const labelled = labelIndexes(points.length);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-center gap-2 border-b border-border bg-slate-50/80 px-4 py-2 text-sm font-medium text-foreground">
        <span className="text-muted" aria-hidden>
          {icon}
        </span>
        {title}
      </header>

      <div className="px-4 pb-2 pt-4">
        <div className="flex gap-2">
          <div
            className="flex w-7 shrink-0 flex-col justify-between text-right text-[10px] leading-none text-muted"
            aria-hidden
          >
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>

          <div className="relative h-32 min-w-0 flex-1">
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick) => (
                <div key={tick} className="border-t border-border/70" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end gap-px">
              {points.map((point) => (
                <div
                  key={point.start}
                  className="min-w-0 flex-1 bg-sky-400/80"
                  style={{ height: `${max > 0 ? (point.count / max) * 100 : 0}%` }}
                  title={`${formatMonthLabel(point.start)}: ${point.count}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex gap-2">
          <div className="w-7 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1">
            {points.map((point, index) => (
              <div key={point.start} className="min-w-0 flex-1 text-[10px] text-muted">
                {labelled.has(index) ? (
                  <span className="whitespace-nowrap">{formatMonthLabel(point.start)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
