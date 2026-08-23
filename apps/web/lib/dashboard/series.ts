import type { DashboardSeriesPoint } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeekUtc(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
  // getUTCDay(): 0 = Sunday, so shift Sunday back a full six days.
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

/** `weeks` consecutive Monday timestamps ending with the week containing `now`. */
export function weekStarts(weeks: number, now: Date = new Date()): Date[] {
  const current = startOfWeekUtc(now);
  const result: Date[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    result.push(new Date(current.getTime() - index * WEEK_MS));
  }
  return result;
}

export function bucketWeekly(
  dates: Date[],
  weeks: number,
  now: Date = new Date(),
): DashboardSeriesPoint[] {
  const starts = weekStarts(weeks, now);
  const firstStart = starts[0]!.getTime();
  const counts = new Array<number>(weeks).fill(0);

  for (const date of dates) {
    const index = Math.floor((startOfWeekUtc(date).getTime() - firstStart) / WEEK_MS);
    if (index >= 0 && index < weeks) {
      counts[index] = (counts[index] ?? 0) + 1;
    }
  }

  return starts.map((start, index) => ({
    start: start.toISOString(),
    count: counts[index]!,
  }));
}
