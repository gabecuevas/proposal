import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { prisma } from "@repo/db";
import { AppShellLayout } from "@/components/app-shell";
import { getServerSession } from "@/lib/auth/server-session";

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
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } })
    : null;

  return (
    <div className={`${fontSans.variable} ${fontSerif.variable}`}>
      <AppShellLayout userEmail={email} userName={displayName(user?.name, email)}>
        {children}
      </AppShellLayout>
    </div>
  );
}
