export type CountKey =
  | "all"
  | "draft"
  | "sent"
  | "viewed"
  | "completed"
  | "expired"
  | "templates"
  | "contentBlocks";

export type AppNavItem = {
  label: string;
  href: string;
  countKey?: CountKey;
};

export type SectionId = "dashboard" | "documents" | "library" | "settings";

export type AppNavFilter = {
  id: "departments" | "members";
  options: string[];
};

export type AppSection = {
  id: SectionId;
  label: string;
  href: string;
  /** Extra path prefixes that resolve to this section beyond `href`. */
  prefixes: string[];
  /** Only treat `href` as belonging to this section on an exact match. */
  exact?: boolean;
  createCta: boolean;
  searchPlaceholder?: string;
  /** Scope selectors rendered above the item list. */
  filters?: AppNavFilter[];
  items: AppNavItem[];
  /** Rendered under a divider at the bottom of the item list. */
  extras?: AppNavItem[];
};

export const appSections: AppSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/app",
    prefixes: ["/app/team-stats", "/app/department-stats", "/app/data-export"],
    exact: true,
    createCta: true,
    filters: [
      { id: "departments", options: ["All Departments"] },
      { id: "members", options: ["All Team Members"] },
    ],
    items: [
      { label: "Overview", href: "/app" },
      { label: "Team Stats", href: "/app/team-stats" },
      { label: "Department Stats", href: "/app/department-stats" },
      { label: "Data Export", href: "/app/data-export" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    href: "/app/documents",
    prefixes: ["/app/proposals"],
    createCta: true,
    searchPlaceholder: "Search everything",
    items: [
      { label: "All", href: "/app/documents", countKey: "all" },
      { label: "Drafts", href: "/app/documents?tab=draft", countKey: "draft" },
      { label: "Sent", href: "/app/documents?tab=sent", countKey: "sent" },
      { label: "Viewed", href: "/app/documents?tab=viewed", countKey: "viewed" },
      { label: "Completed", href: "/app/documents?tab=completed", countKey: "completed" },
      { label: "Expired", href: "/app/documents?tab=expired", countKey: "expired" },
    ],
  },
  {
    id: "library",
    label: "Library",
    href: "/app/templates",
    prefixes: ["/app/content-library"],
    createCta: true,
    items: [
      { label: "Templates", href: "/app/templates", countKey: "templates" },
      { label: "Content Blocks", href: "/app/content-library", countKey: "contentBlocks" },
    ],
    extras: [{ label: "Create a template", href: "/app/templates/new" }],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/app/settings",
    prefixes: ["/app/contacts", "/app/analytics"],
    createCta: false,
    items: [
      { label: "Workspace", href: "/app/settings" },
      { label: "My Contacts", href: "/app/contacts" },
      { label: "Analytics", href: "/app/analytics" },
      { label: "Compliance", href: "/app/settings#compliance" },
      { label: "Developer API", href: "/app/settings#api-keys" },
      { label: "Webhooks", href: "/app/settings#webhooks" },
    ],
  },
];

const dashboardSection = appSections[0]!;

export function resolveSection(pathname: string): AppSection {
  const matches = appSections.filter((section) => {
    if (!section.exact && (pathname === section.href || pathname.startsWith(`${section.href}/`))) {
      return true;
    }
    return section.prefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  });

  // Longest href wins so nested routes never fall back to a broader section.
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? dashboardSection;
}

/**
 * Routes that replace the app chrome with their own full-window layout. The
 * document creator needs the whole viewport for its canvas and side panels.
 */
const immersivePrefixes = ["/app/templates/", "/app/documents/"];
const immersiveExclusions = ["/app/templates/new"];

export function isImmersivePath(pathname: string): boolean {
  if (immersiveExclusions.includes(pathname)) {
    return false;
  }
  if (pathname === "/app/proposals/new") {
    return true;
  }
  return immersivePrefixes.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length,
  );
}

/** Trailing breadcrumb labels for routes that have no matching sidebar item. */
const detailCrumbs: Array<{ prefix: string; label: string }> = [
  { prefix: "/app/proposals/new", label: "New document" },
  { prefix: "/app/templates/new", label: "New template" },
  { prefix: "/app/documents/", label: "Document" },
  { prefix: "/app/templates/", label: "Template" },
];

export function detailCrumbFor(pathname: string): string | null {
  return detailCrumbs.find((crumb) => pathname.startsWith(crumb.prefix))?.label ?? null;
}

export function navItemHrefPath(href: string): string {
  return href.split(/[?#]/)[0]!;
}

export function navItemHrefQuery(href: string): string | null {
  const match = /\?([^#]*)/.exec(href);
  return match?.[1] ?? null;
}

export function navItemHrefHash(href: string): string | null {
  const index = href.indexOf("#");
  return index === -1 ? null : href.slice(index);
}

export function isNavItemActive(
  item: AppNavItem,
  pathname: string,
  tabParam: string | null,
  hash: string,
): boolean {
  if (pathname !== navItemHrefPath(item.href)) {
    return false;
  }
  const itemHash = navItemHrefHash(item.href);
  if (itemHash) {
    return hash === itemHash;
  }
  const itemTab = new URLSearchParams(navItemHrefQuery(item.href) ?? "").get("tab");
  if (itemTab) {
    return tabParam === itemTab;
  }
  return !hash && !tabParam;
}
