import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";
import { getServerSession } from "@/lib/auth/server-session";
import { isSupportAdminEnabled } from "@/lib/support/flags";
import { syncPlatformAdminFlag } from "@/lib/support/platform-admin";

const nav = [
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/messages", label: "Messages" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isSupportAdminEnabled()) {
    notFound();
  }
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/admin/contacts");
  }
  if (session.impersonationId) {
    redirect("/app");
  }
  const isAdmin = await syncPlatformAdminFlag(session.userId, session.email);
  if (!isAdmin) {
    notFound();
  }

  return (
    <div className="app-theme flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-4 py-3">
        <Link
          href="/admin/contacts"
          aria-label="SendDox Support Admin"
          className="flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <SendDoxLogo className="h-5 text-[#1e3a5f]" title="" />
          <span className="border-l border-border pl-2 text-muted">Support Admin</span>
        </Link>
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-none border border-border px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/app" className="ml-auto text-sm text-muted hover:text-foreground">
          Back to app
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
