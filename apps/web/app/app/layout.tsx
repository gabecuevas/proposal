import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { AppShellLayout } from "@/components/app-shell";
import type { BillingBannerInfo } from "@/components/app-shell/billing-banner";
import { getServerSession } from "@/lib/auth/server-session";
import { assetUrl } from "@/lib/storage/asset-url";
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
        select: { name: true, email: true, disabled_at: true, avatar_asset_key: true },
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

  let billingBanner: BillingBannerInfo | null = null;
  if (session?.workspaceId && (session.role === "OWNER" || session.role === "ADMIN")) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { plan: true, trial_ends_at: true, subscription_status: true },
    });
    if (workspace?.subscription_status === "past_due" || workspace?.subscription_status === "unpaid") {
      billingBanner = { kind: "past_due" };
    } else if (
      workspace?.plan === "trial" &&
      workspace.trial_ends_at &&
      workspace.subscription_status !== "active"
    ) {
      const msLeft = workspace.trial_ends_at.getTime() - Date.now();
      billingBanner =
        msLeft <= 0
          ? { kind: "trial_expired" }
          : { kind: "trial", daysLeft: Math.ceil(msLeft / (24 * 60 * 60 * 1000)) };
    }
  }

  return (
    <div className={`${fontSans.variable} ${fontSerif.variable}`}>
      <AppShellLayout
        userEmail={email}
        userName={displayName(user?.name, email)}
        userAvatarUrl={user?.avatar_asset_key ? assetUrl(user.avatar_asset_key) : null}
        messengerEnabled={isSupportMessengerEnabled() && !sudo}
        sudo={sudo}
        billingBanner={billingBanner}
      >
        {children}
      </AppShellLayout>
    </div>
  );
}
