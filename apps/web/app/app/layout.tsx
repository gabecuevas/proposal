import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { AppShellLayout } from "@/components/app-shell";
import { getServerSession } from "@/lib/auth/server-session";
import { isSupportMessengerEnabled } from "@/lib/support/flags";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-app-sans",
});

const fontSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-app-serif",
});

function displayName(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    return name.trim();
  }
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getServerSession();
  const email = session?.email ?? "unknown";
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true, disabled_at: true },
      })
    : null;

  if (session && user?.disabled_at && !session.impersonationId) {
    redirect("/api/auth/disabled");
  }

  let sudo: { targetEmail: string; adminEmail: string; expiresAt: string } | null = null;
  if (session?.impersonationId) {
    const record = await prisma.supportImpersonationSession.findUnique({
      where: { id: session.impersonationId },
      select: { admin_email: true, target_email: true, expires_at: true, ended_at: true },
    });
    if (!record || record.ended_at || record.expires_at <= new Date() || user?.disabled_at) {
      redirect("/api/admin/sudo/end");
    }
    sudo = {
      targetEmail: user?.email ?? record.target_email,
      adminEmail: record.admin_email,
      expiresAt: record.expires_at.toISOString(),
    };
  }

  return (
    <div className={`${fontSans.variable} ${fontSerif.variable}`}>
      <AppShellLayout
        userEmail={email}
        userName={displayName(user?.name, email)}
        messengerEnabled={isSupportMessengerEnabled() && !sudo}
        sudo={sudo}
      >
        {children}
      </AppShellLayout>
    </div>
  );
}
