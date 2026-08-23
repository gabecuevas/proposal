import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif } from "next/font/google";
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

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getServerSession();
  const email = session?.email ?? "unknown";
  const role = session?.role ?? "MEMBER";

  return (
    <div className={`${fontSans.variable} ${fontSerif.variable}`}>
      <AppShellLayout userEmail={email} userRole={role}>
        {children}
      </AppShellLayout>
    </div>
  );
}
