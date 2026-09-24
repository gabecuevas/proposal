/**
 * Server-side feature flags for the platform support module.
 * Defaults are off so production stays unchanged until explicitly enabled.
 */

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function isSupportAdminEnabled(): boolean {
  return envFlag("SUPPORT_ADMIN_ENABLED");
}

export function isSupportMessengerEnabled(): boolean {
  return envFlag("SUPPORT_MESSENGER_ENABLED");
}

export function isSupportCampaignsEnabled(): boolean {
  return envFlag("SUPPORT_CAMPAIGNS_ENABLED");
}

export function isSupportEmailEnabled(): boolean {
  return envFlag("SUPPORT_EMAIL_ENABLED");
}

export function supportEmailDelaySeconds(): number {
  const raw = Number(process.env.SUPPORT_EMAIL_DELAY_SECONDS ?? "120");
  if (!Number.isFinite(raw) || raw < 0) {
    return 120;
  }
  return Math.min(Math.floor(raw), 3600);
}

export function supportReplyDomain(): string {
  return (process.env.SUPPORT_REPLY_DOMAIN ?? "reply.senddox.com").trim().toLowerCase();
}

export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
