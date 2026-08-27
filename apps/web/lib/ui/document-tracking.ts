export const DOCUMENT_TRACKING_TABS = [
  "in-progress",
  "completed",
  "viewed",
  "unviewed",
  "declined",
  "draft",
  "archived",
  "pending",
  "trash",
] as const;

export type DocumentTrackingTab = (typeof DOCUMENT_TRACKING_TABS)[number];

export type DocumentCountKey =
  | "inProgress"
  | "completed"
  | "viewed"
  | "unviewed"
  | "declined"
  | "draft"
  | "archived"
  | "pending"
  | "trash";

export type DocumentTrackingNavItem = {
  label: string;
  href: string;
  countKey: DocumentCountKey;
  icon: DocumentCountKey;
};

export const DEFAULT_DOCUMENT_TAB: DocumentTrackingTab = "in-progress";

/** Prisma statuses currently rolled into each tracking view. Empty = not stored yet. */
export const STATUSES_BY_TAB: Record<DocumentTrackingTab, readonly string[]> = {
  "in-progress": ["SENT", "VIEWED", "COMMENTED"],
  completed: ["SIGNED", "PAID"],
  viewed: ["VIEWED", "COMMENTED"],
  unviewed: ["SENT"],
  declined: ["VOID"],
  draft: ["DRAFTED"],
  archived: ["EXPIRED"],
  pending: [],
  trash: [],
};

const TAB_BY_COUNT_KEY: Record<DocumentCountKey, DocumentTrackingTab> = {
  inProgress: "in-progress",
  completed: "completed",
  viewed: "viewed",
  unviewed: "unviewed",
  declined: "declined",
  draft: "draft",
  archived: "archived",
  pending: "pending",
  trash: "trash",
};

const LEGACY_TAB_ALIASES: Record<string, DocumentTrackingTab> = {
  all: "in-progress",
  sent: "unviewed",
  expired: "archived",
};

export const DOCUMENT_TRACKING_NAV: DocumentTrackingNavItem[] = [
  { label: "In Progress", href: "/app/documents", countKey: "inProgress", icon: "inProgress" },
  { label: "Completed", href: "/app/documents?tab=completed", countKey: "completed", icon: "completed" },
  { label: "Viewed", href: "/app/documents?tab=viewed", countKey: "viewed", icon: "viewed" },
  { label: "Unviewed", href: "/app/documents?tab=unviewed", countKey: "unviewed", icon: "unviewed" },
  { label: "Declined", href: "/app/documents?tab=declined", countKey: "declined", icon: "declined" },
  { label: "Drafts", href: "/app/documents?tab=draft", countKey: "draft", icon: "draft" },
  {
    label: "Archived/Expired",
    href: "/app/documents?tab=archived",
    countKey: "archived",
    icon: "archived",
  },
  { label: "Pending", href: "/app/documents?tab=pending", countKey: "pending", icon: "pending" },
  { label: "Trash", href: "/app/documents?tab=trash", countKey: "trash", icon: "trash" },
];

function isTrackingTab(value: string): value is DocumentTrackingTab {
  return (DOCUMENT_TRACKING_TABS as readonly string[]).includes(value);
}

export function toDocumentTrackingTab(value: string | null | undefined): DocumentTrackingTab {
  if (!value) {
    return DEFAULT_DOCUMENT_TAB;
  }
  if (isTrackingTab(value)) {
    return value;
  }
  return LEGACY_TAB_ALIASES[value] ?? DEFAULT_DOCUMENT_TAB;
}

export function matchesDocumentTab(tab: DocumentTrackingTab, status: string): boolean {
  return STATUSES_BY_TAB[tab].includes(status.toUpperCase());
}

export function countDocumentsForTab(
  byStatus: Record<string, number>,
  tab: DocumentTrackingTab,
): number {
  return STATUSES_BY_TAB[tab].reduce((total, status) => total + (byStatus[status] ?? 0), 0);
}

export function documentTrackingCounts(
  byStatus: Record<string, number>,
): Record<DocumentCountKey, number> {
  const counts = {} as Record<DocumentCountKey, number>;
  for (const [countKey, tab] of Object.entries(TAB_BY_COUNT_KEY) as Array<
    [DocumentCountKey, DocumentTrackingTab]
  >) {
    counts[countKey] = countDocumentsForTab(byStatus, tab);
  }
  return counts;
}

export function documentStatusDisplayLabel(status: string): string {
  const value = status.toUpperCase();
  if (value === "DRAFTED") {
    return "Draft";
  }
  if (value === "SENT") {
    return "Unviewed";
  }
  if (value === "VIEWED" || value === "COMMENTED") {
    return "Viewed";
  }
  if (value === "SIGNED" || value === "PAID") {
    return "Completed";
  }
  if (value === "VOID") {
    return "Declined";
  }
  if (value === "EXPIRED") {
    return "Expired";
  }
  return value.charAt(0) + value.slice(1).toLowerCase();
}
