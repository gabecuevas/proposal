"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import { documentTrackingCounts } from "@/lib/ui/document-tracking";
import { SettingsMenu } from "./settings-menu";
import { sidebarIcons, IconSearch } from "./shell-icons";
import { isNavItemActive, navItemHrefHash, type AppSection, type CountKey, type SectionId } from "./nav-config";
import { APP_SIDEBAR_WIDTH_CLASS } from "./shell-metrics";

type AppSidebarProps = {
  section: AppSection;
  pathname: string;
  tabParam: string | null;
  hash: string;
  onHashChange: (hash: string) => void;
  userEmail: string;
  userName: string;
  userInitials: string;
  open: boolean;
  onNavigate: () => void;
};

type Counts = Partial<Record<CountKey, number>>;

function useTeamMemberCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/workspace/members");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { members?: unknown[] };
      if (!cancelled) {
        setCount(payload.members?.length ?? 0);
      }
    }
    void load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}

function useShellCounts(sectionId: SectionId): Counts {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let cancelled = false;

    async function loadDocumentCounts() {
      const response = await fetch("/api/dashboard/summary");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { counts?: Record<string, number> };
      const byStatus = payload.counts ?? {};
      if (cancelled) {
        return;
      }
      setCounts(documentTrackingCounts(byStatus));
    }

    async function loadLibraryCounts() {
      const [templatesResponse, blocksResponse] = await Promise.all([
        fetch("/api/templates?limit=200"),
        fetch("/api/content-blocks"),
      ]);
      const templates = templatesResponse.ok
        ? ((await templatesResponse.json()) as { templates?: unknown[] }).templates?.length
        : undefined;
      const blocks = blocksResponse.ok
        ? ((await blocksResponse.json()) as { blocks?: unknown[] }).blocks?.length
        : undefined;
      if (cancelled) {
        return;
      }
      setCounts({ templates, contentBlocks: blocks });
    }

    async function loadCrmCounts() {
      const response = await fetch("/api/crm/summary");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        counts?: { leads?: number; people?: number; companies?: number };
      };
      if (cancelled) {
        return;
      }
      setCounts({
        leads: payload.counts?.leads ?? 0,
        people: payload.counts?.people ?? 0,
        companies: payload.counts?.companies ?? 0,
      });
    }

    setCounts({});
    if (sectionId === "documents") {
      void loadDocumentCounts().catch(() => undefined);
    } else if (sectionId === "library") {
      void loadLibraryCounts().catch(() => undefined);
    } else if (sectionId === "contacts") {
      void loadCrmCounts().catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  return counts;
}

export function AppSidebar({
  section,
  pathname,
  tabParam,
  hash,
  onHashChange,
  userEmail,
  userName,
  userInitials,
  open,
  onNavigate,
}: AppSidebarProps) {
  const counts = useShellCounts(section.id);
  const teamMemberCount = useTeamMemberCount(
    Boolean(section.filters?.some((filter) => filter.id === "members")),
  );

  return (
    <aside
      id="app-shell-sidebar"
      aria-label={`${section.label} navigation`}
      className={cn(
        "sticky top-14 z-20 flex h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-out",
        "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:top-14 max-md:z-40 max-md:h-auto max-md:shadow-xl",
        open ? APP_SIDEBAR_WIDTH_CLASS : "w-0 border-r-0",
      )}
    >
      <div
        className={cn(
          `flex h-full ${APP_SIDEBAR_WIDTH_CLASS} min-w-[240px] flex-col`,
          !open && "pointer-events-none opacity-0",
        )}
      >
        {section.createCta ? (
          <div className="shrink-0 px-3 pb-2 pt-3">
            <Link
              href="/app/proposals/new"
              onClick={onNavigate}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
            >
              <span className="text-base leading-none">+</span>
              New Document
            </Link>
          </div>
        ) : null}

        {section.searchPlaceholder ? (
          <div className="relative shrink-0 px-3 pb-1 pt-2">
            <span
              className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            >
              <IconSearch />
            </span>
            <label htmlFor="app-sidebar-search" className="sr-only">
              {section.searchPlaceholder}
            </label>
            <input
              id="app-sidebar-search"
              type="search"
              placeholder={section.searchPlaceholder}
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-primary/20 placeholder:text-muted/80 focus:border-primary/40 focus:ring-2"
            />
          </div>
        ) : null}

        {section.filters?.length ? (
          <div className="shrink-0 space-y-1.5 px-3 pb-1 pt-2">
            {section.filters.map((filter) => {
              const label =
                filter.id === "members" && teamMemberCount !== null
                  ? `${filter.options[0]} (${teamMemberCount})`
                  : filter.options[0]!;
              return (
                <select
                  key={filter.id}
                  aria-label={filter.options[0]}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none ring-primary/20 focus:border-primary/40 focus:ring-2"
                  defaultValue={label}
                >
                  <option>{label}</option>
                </select>
              );
            })}
          </div>
        ) : null}

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {section.items.map((item) => {
            const active = isNavItemActive(item, pathname, tabParam, hash);
            const count = item.countKey ? counts[item.countKey] : undefined;
            const itemHash = navItemHrefHash(item.href);
            const Icon = item.icon ? sidebarIcons[item.icon] : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onHashChange(itemHash ?? "");
                  onNavigate();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border-l-2 py-2 pl-2.5 pr-2 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/[0.07] font-medium text-primary"
                    : "border-transparent text-muted hover:bg-slate-100/80 hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="shrink-0" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {typeof count === "number" ? (
                  <span
                    className={cn(
                      "shrink-0 tabular-nums text-xs",
                      active ? "text-primary" : "text-muted",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {section.extras?.length ? (
            <div className="mt-2 space-y-0.5 border-t border-border pt-2">
              {section.extras.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className="block rounded-md py-1.5 pl-2.5 pr-2 text-xs text-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-border px-2 py-2">
          <SettingsMenu
            userName={userName}
            userEmail={userEmail}
            userInitials={userInitials}
            active={section.id === "settings"}
          />
        </div>
      </div>
    </aside>
  );
}
