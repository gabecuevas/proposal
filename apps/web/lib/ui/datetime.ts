export function formatGridDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** History timeline style: "Today at 7:23 PM" / "Yesterday at …" / full datetime. */
export function formatHistoryDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((start.getTime() - dayStart.getTime()) / 86400000);
  if (diffDays === 0) {
    return `Today at ${time}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${time}`;
  }
  return formatGridDateTime(iso);
}

export function formatGridDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMinorCurrency(minor: number | null | undefined, currency = "USD"): string {
  if (minor == null || !Number.isFinite(minor)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
