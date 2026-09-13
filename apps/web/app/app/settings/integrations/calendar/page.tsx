"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { SheetPage } from "@/components/ui/sheet-table";
import {
  DEFAULT_MY_CALENDAR_EVENT_COLOR,
  MY_CALENDAR_EVENT_COLOR_PRESETS,
  normalizeCalendarEventColor,
  type CrmCalendarAccountDto,
} from "@/lib/crm/calendar-accounts";

const TABS = [
  { id: "account", label: "Account" },
  { id: "general", label: "General settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function oauthErrorMessage(code: string | null): string | null {
  switch (code) {
    case "google_not_configured":
      return "Google OAuth isn’t configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env, then restart the app.";
    case "google_denied":
      return "Google authorization was cancelled. Try again when you’re ready to allow SendDox calendar access.";
    case "google_state_mismatch":
      return "The Google sign-in session expired. Start the connection again.";
    case "google_connect_failed":
      return "Google Calendar authorization didn’t complete. Try Connect with Google again.";
    default:
      return code ? "Could not complete calendar authorization." : null;
  }
}

export default function CalendarSyncSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>("account");
  const [account, setAccount] = useState<CrmCalendarAccountDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [eventColor, setEventColor] = useState(DEFAULT_MY_CALENDAR_EVENT_COLOR);
  const [savingColor, setSavingColor] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(
    null,
  );

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crm/calendar-accounts");
      const payload = (await response.json().catch(() => ({}))) as {
        accounts?: CrmCalendarAccountDto[];
      };
      const next = payload.accounts?.[0] ?? null;
      setAccount(next);
      setEventColor(next?.eventColor ?? DEFAULT_MY_CALENDAR_EVENT_COLOR);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/crm/calendar-accounts/google/status");
        const payload = (await response.json().catch(() => ({}))) as { configured?: boolean };
        if (!cancelled) {
          setGoogleConfigured(Boolean(payload.configured));
        }
      } catch {
        if (!cancelled) {
          setGoogleConfigured(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) {
      return;
    }
    if (connected === "1") {
      setBanner({
        tone: "success",
        message: "Google Calendar connected. Events are syncing into Contacts → Calendar.",
      });
      setTab("account");
      void loadAccount();
    } else if (error) {
      const message = oauthErrorMessage(error);
      if (message) {
        setBanner({
          tone: error === "google_not_configured" ? "warning" : "error",
          message,
        });
      }
    }
    router.replace("/app/settings/integrations/calendar");
  }, [loadAccount, router, searchParams]);

  async function syncNow() {
    if (!account) return;
    setSyncing(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/crm/calendar-accounts/${account.id}/sync`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        imported?: number;
        scanned?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not sync Google Calendar.");
      }
      setBanner({
        tone: "success",
        message: `Synced ${payload.imported ?? 0} Google Calendar event${(payload.imported ?? 0) === 1 ? "" : "s"}.`,
      });
      await loadAccount();
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Could not sync Google Calendar.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!account) return;
    setDisconnecting(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/crm/calendar-accounts/${account.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not disconnect Google Calendar.");
      }
      setConfirmDisconnect(false);
      setAccount(null);
      setEventColor(DEFAULT_MY_CALENDAR_EVENT_COLOR);
      setTab("account");
      setBanner({
        tone: "success",
        message: "Disconnected Google Calendar. Synced events were removed from SendDox.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Could not disconnect Google Calendar.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  async function saveEventColor() {
    if (!account) return;
    const color = normalizeCalendarEventColor(eventColor);
    if (!color) {
      setBanner({
        tone: "error",
        message: "Pick a valid hex color (for example #7C3AED).",
      });
      return;
    }
    setSavingColor(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/crm/calendar-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventColor: color }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        account?: CrmCalendarAccountDto;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save calendar color.");
      }
      if (payload.account) {
        setAccount(payload.account);
        setEventColor(payload.account.eventColor);
      }
      setBanner({
        tone: "success",
        message: "My Calendar event color saved. It will show on Contacts → Calendar.",
      });
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Could not save calendar color.",
      });
    } finally {
      setSavingColor(false);
    }
  }

  const colorDirty = Boolean(account && eventColor.toUpperCase() !== account.eventColor.toUpperCase());

  return (
    <SheetPage
      toolbar={
        <div className="w-full space-y-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Calendar Sync</h1>
            <p className="mt-0.5 text-sm text-muted">
              Connect Google Calendar so events appear alongside CRM activities in{" "}
              <Link href="/app/contacts/calendar" className="font-medium text-primary hover:underline">
                Contacts → Calendar
              </Link>
              .
            </p>
          </div>
          {banner ? (
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                banner.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
                banner.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
                banner.tone === "error" && "border-red-200 bg-red-50 text-red-900",
              )}
            >
              <p>{banner.message}</p>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {googleConfigured === false && !banner ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Google Calendar needs <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-xs">GOOGLE_CLIENT_SECRET</code>. Add the redirect URI{" "}
              <code className="text-xs">/api/crm/calendar-accounts/google/callback</code> in Google Cloud,
              then restart the app.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1 border-b border-border">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                  tab === item.id
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {tab === "account" ? (
        <div className="max-w-2xl space-y-5 p-5">
          <section className="space-y-4 rounded-lg border border-border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Google Calendar</h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  account?.syncStatus === "ACTIVE"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : account?.syncStatus === "ERROR"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-red-200 bg-red-50 text-red-700",
                )}
              >
                {account?.syncStatus === "ACTIVE"
                  ? "Sync active"
                  : account?.syncStatus === "ERROR"
                    ? "Sync error"
                    : "Sync inactive"}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : account ? (
              <>
                <p className="text-sm text-foreground">
                  Connected as <span className="font-medium">{account.email}</span>
                  {account.calendarName ? (
                    <>
                      {" "}
                      · Calendar: <span className="font-medium">{account.calendarName}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-sm text-muted">
                  {account.lastSyncedAt
                    ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}.`
                    : "Connected. Run Sync to pull events into SendDox."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void syncNow()}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <Link
                    href="/app/contacts/calendar"
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                  >
                    Open Calendar
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  Connect your Google Calendar so meetings and events show up next to CRM activities in SendDox.
                </p>
                <button
                  type="button"
                  disabled={googleConfigured === false}
                  onClick={() => {
                    window.location.assign("/api/crm/calendar-accounts/google/start");
                  }}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
                >
                  Connect Google Calendar
                </button>
              </>
            )}
          </section>

          {account ? (
            <section className="space-y-3 rounded-lg border border-border bg-slate-50/70 p-5">
              <h2 className="text-sm font-semibold text-foreground">Disconnect</h2>
              <p className="text-sm text-muted">
                Removes this Google Calendar connection and clears synced events from SendDox. Your Google Calendar
                itself is unchanged.
              </p>
              {!confirmDisconnect ? (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Disconnect Google Calendar
                </button>
              ) : (
                <div className="space-y-3 rounded-md border border-red-200 bg-red-50 px-3 py-3">
                  <p className="text-sm text-red-950">
                    Disconnect <span className="font-medium">{account.email}</span>?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disconnecting}
                      onClick={() => void disconnect()}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {disconnecting ? "Disconnecting…" : "Yes, disconnect"}
                    </button>
                    <button
                      type="button"
                      disabled={disconnecting}
                      onClick={() => setConfirmDisconnect(false)}
                      className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : account ? (
        <div className="max-w-2xl space-y-5 p-5">
          <section className="space-y-4 rounded-lg border border-border bg-white p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">My Calendar events</h2>
              <p className="mt-1 text-sm text-muted">
                Choose a color for events imported from Calendar Sync so you can tell them apart from CRM-created
                activities on Contacts → Calendar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <span
                  className="h-8 w-8 overflow-hidden rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: eventColor }}
                >
                  <input
                    type="color"
                    value={eventColor}
                    onChange={(event) => setEventColor(event.target.value.toUpperCase())}
                    className="h-10 w-10 -translate-x-1 -translate-y-1 cursor-pointer appearance-none border-0 bg-transparent p-0"
                    aria-label="My Calendar event color"
                  />
                </span>
                Color
              </label>
              <input
                type="text"
                value={eventColor}
                onChange={(event) => setEventColor(event.target.value.toUpperCase())}
                spellCheck={false}
                className="w-28 rounded-md border border-border bg-white px-2.5 py-1.5 font-mono text-sm text-foreground"
                aria-label="Hex color"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {MY_CALENDAR_EVENT_COLOR_PRESETS.map((preset) => {
                const active = eventColor.toUpperCase() === preset.toUpperCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    title={preset}
                    aria-label={`Use color ${preset}`}
                    onClick={() => setEventColor(preset)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-105",
                      active ? "border-foreground" : "border-white ring-1 ring-border",
                    )}
                    style={{ backgroundColor: preset }}
                  />
                );
              })}
            </div>

            <div
              className="inline-flex max-w-full items-center gap-1 rounded border px-2 py-1 text-[11px]"
              style={{
                borderColor: `color-mix(in srgb, ${eventColor} 45%, white)`,
                backgroundColor: `color-mix(in srgb, ${eventColor} 14%, white)`,
                color: `color-mix(in srgb, ${eventColor} 72%, black)`,
              }}
            >
              <span className="truncate font-bold">Preview · Team standup</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={savingColor || !colorDirty}
                onClick={() => void saveEventColor()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
              >
                {savingColor ? "Saving…" : "Save color"}
              </button>
              {colorDirty ? (
                <button
                  type="button"
                  disabled={savingColor}
                  onClick={() => setEventColor(account.eventColor)}
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-60"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="max-w-2xl space-y-3 p-5">
          <h2 className="text-sm font-semibold text-foreground">General settings</h2>
          <p className="text-sm text-muted">
            Connect a Google Calendar account first to choose a color for My Calendar events.
          </p>
          <button
            type="button"
            onClick={() => setTab("account")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to Account
          </button>
        </div>
      )}
    </SheetPage>
  );
}
