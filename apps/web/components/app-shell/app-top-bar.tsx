"use client";

import Link from "next/link";
import { cn } from "@repo/ui/utils";
import {
  IconBell,
  IconDocument,
  IconHome,
  IconLibrary,
  IconMenu,
  IconSearch,
  IconSettings,
} from "./shell-icons";
import { appSections, type SectionId } from "./nav-config";

const sectionIcons: Record<SectionId, (props: { className?: string }) => React.ReactElement> = {
  dashboard: IconHome,
  documents: IconDocument,
  library: IconLibrary,
  settings: IconSettings,
};

function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 18v-.5M9.5 9a2.5 2.5 0 115 0c0 1.5-1.5 2-2.5 2.5V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type AppTopBarProps = {
  activeSectionId: SectionId;
  userInitials: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export function AppTopBar({
  activeSectionId,
  userInitials,
  sidebarOpen,
  onToggleSidebar,
}: AppTopBarProps) {
  const initials = (userInitials || "DS").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-controls="app-shell-sidebar"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        className="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
      >
        <IconMenu />
      </button>

      <Link
        href="/app"
        className="font-app-serif shrink-0 pr-1 text-lg font-semibold tracking-tight text-foreground sm:pr-3"
      >
        DoxySign
      </Link>

      <nav
        aria-label="Primary"
        className="flex h-full min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto"
      >
        {appSections.map((section) => {
          const Icon = sectionIcons[section.id];
          const active = section.id === activeSectionId;
          return (
            <Link
              key={section.id}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors",
                active
                  ? "border-primary bg-background font-medium text-primary"
                  : "border-transparent text-muted hover:bg-slate-50 hover:text-foreground",
              )}
            >
              <Icon className="shrink-0 opacity-80" />
              <span className="hidden sm:inline">{section.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative hidden w-56 lg:block xl:w-72">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          >
            <IconSearch />
          </span>
          <label htmlFor="app-shell-search" className="sr-only">
            Search documents
          </label>
          <input
            id="app-shell-search"
            type="search"
            placeholder="Search documents"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-primary/20 placeholder:text-muted/80 focus:border-primary/40 focus:ring-2"
          />
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
          aria-label="Help"
        >
          <IconHelp className="mx-auto" />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
          aria-label="Notifications"
        >
          <IconBell className="mx-auto" />
        </button>
        <div
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
          title="Account"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
