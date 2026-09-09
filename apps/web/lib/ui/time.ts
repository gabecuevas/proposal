export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) {
    return "just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hr / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (days < 14) {
    return "1 week ago";
  }
  return new Date(iso).toLocaleDateString();
}

export function formatRelativeContact(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayStart = new Date(then);
  dayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((start.getTime() - dayStart.getTime()) / 86400000);
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return formatRelativeTime(iso);
}

/** Calendar date for list columns (Created / Due). */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    // Already a YYYY-MM-DD value from <input type="date">
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (match) {
      const local = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return local.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
    return iso.trim();
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
