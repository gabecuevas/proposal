const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "Never";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  for (const [unit, size] of RELATIVE_UNITS) {
    if (seconds >= size) {
      return relativeFormatter.format(-Math.floor(seconds / size), unit);
    }
  }
  return "Just now";
}

export function dateOnly(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

export function dateTime(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Never";
}

export function statusBadgeClass(status: string): string {
  if (status === "Disabled") return "border-red-300 bg-red-50 text-red-700";
  if (status === "Archived") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}
