import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { getServerSession } from "@/lib/auth/server-session";

const navItems = [
  { label: "Dashboard", href: "/app" },
  { label: "Templates", href: "/app/templates" },
  { label: "Documents", href: "/app/documents" },
  { label: "Contacts", href: "/app/contacts" },
  { label: "Content Library", href: "/app/content-library" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Settings", href: "/app/settings" },
];

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getServerSession();
  const email = session?.email ?? "unknown";
  const role = session?.role ?? "MEMBER";

  return (
    <div className="app-theme grid min-h-screen grid-cols-1 bg-background md:grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">ProposalOS</h2>
        <div className="mt-2 rounded border border-border bg-background p-2 text-xs text-muted">
          <p>{email}</p>
          <p>{role}</p>
        </div>
        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-background"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </aside>
      <section className="p-6">{children}</section>
    </div>
  );
}
