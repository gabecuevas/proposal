import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
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
  const isAdmin = await syncPlatformAdminFlag(session.userId, session.email);
  if (!isAdmin) {
    notFound();
  }

  return (
    <div className="app-theme flex min-h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-4 py-3">
        <Link href="/admin/contacts" className="text-sm font-semibold text-primary">
          SendDox Support Admin
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
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
