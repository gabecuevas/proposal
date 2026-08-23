"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { AppBreadcrumbs } from "./app-breadcrumbs";
import { AppSidebar } from "./app-sidebar";
import { AppTopBar } from "./app-top-bar";
import { resolveSection } from "./nav-config";

type AppShellLayoutProps = {
  children: ReactNode;
  userEmail: string;
  userRole: string;
  userInitials?: string;
};

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "DS";
}

function AppShellChrome({ children, userEmail, userRole, userInitials }: AppShellLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hash, setHash] = useState("");

  const section = resolveSection(pathname);
  const tabParam = searchParams.get("tab");
  const resolvedInitials = userInitials?.trim() || initialsFromEmail(userEmail);

  const isCompact = useCallback(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
    [],
  );

  useEffect(() => {
    if (isCompact()) {
      setSidebarOpen(false);
    }
  }, [isCompact]);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  // Anchor targets on data-driven pages can mount after the route transition,
  // so retry briefly instead of relying on the browser's one-shot hash scroll.
  useEffect(() => {
    if (!hash) {
      return;
    }
    let attempts = 0;
    let frame = 0;
    const scrollToTarget = () => {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (attempts++ < 60) {
        frame = requestAnimationFrame(scrollToTarget);
      }
    };
    frame = requestAnimationFrame(scrollToTarget);
    return () => cancelAnimationFrame(frame);
  }, [hash, pathname]);

  const closeIfCompact = useCallback(() => {
    if (isCompact()) {
      setSidebarOpen(false);
    }
  }, [isCompact]);

  return (
    <div className="app-theme flex min-h-screen w-full flex-col bg-background">
      <AppTopBar
        activeSectionId={section.id}
        userInitials={resolvedInitials}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1">
        <AppSidebar
          section={section}
          pathname={pathname}
          tabParam={tabParam}
          hash={hash}
          onHashChange={setHash}
          userEmail={userEmail}
          userRole={userRole}
          open={sidebarOpen}
          onNavigate={closeIfCompact}
        />
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 top-14 z-30 bg-slate-900/20 md:hidden"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppBreadcrumbs
            section={section}
            pathname={pathname}
            tabParam={tabParam}
            hash={hash}
          />
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AppShellLayout(props: AppShellLayoutProps) {
  return (
    <Suspense fallback={<div className="app-theme min-h-screen bg-background" />}>
      <AppShellChrome {...props} />
    </Suspense>
  );
}
