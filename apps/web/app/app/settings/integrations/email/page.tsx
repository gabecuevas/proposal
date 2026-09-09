"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { EmailAccountConnectWizard } from "@/components/crm/email-account-connect-wizard";
import { SheetPage } from "@/components/ui/sheet-table";
import {
  PERSONAL_EMAIL_ACCOUNT_LIMIT,
  providerDisplayName,
  type CrmEmailAccountDto,
  type EmailSyncProviderId,
} from "@/lib/crm/emails";

const TABS = [
  { id: "account", label: "Account" },
  { id: "smart-bcc", label: "Smart Bcc" },
  { id: "blocked", label: "Blocked addresses" },
  { id: "general", label: "General settings" },
  { id: "email-ai", label: "Email AI" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function providerInitial(provider: EmailSyncProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "G";
    case "OFFICE365":
      return "O";
    case "EXCHANGE":
      return "E";
    default:
      return "@";
  }
}

function providerAvatarClass(provider: EmailSyncProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "bg-emerald-600 text-white";
    case "OFFICE365":
      return "bg-[#D83B01] text-white";
    case "EXCHANGE":
      return "bg-[#0078D4] text-white";
    default:
      return "bg-slate-700 text-white";
  }
}

function oauthErrorMessage(code: string | null): string | null {
  switch (code) {
    case "google_not_configured":
      return "Google OAuth isn’t configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env, then restart the app.";
    case "google_denied":
      return "Google authorization was cancelled. Try again when you’re ready to allow SendDox access.";
    case "google_state_mismatch":
      return "The Google sign-in session expired. Start the connection again.";
    case "google_email_mismatch":
      return "You signed into a different Google account than the email you entered. Try again with the matching account.";
    case "google_connect_failed":
      return "Google authorization didn’t complete. Try Connect with Google again.";
    case "account_limit":
      return "You’ve reached the personal email account limit (3).";
    case "provider_conflict":
      return "That address is already connected with a different provider.";
    case "invalid_email":
      return "Enter a valid email address before connecting Google.";
    default:
      return code ? "Could not complete email authorization." : null;
  }
}

export default function EmailSyncSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>("account");
  const [accounts, setAccounts] = useState<CrmEmailAccountDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(
    null,
  );
  const [wizardOpen, setWizardOpen] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [syncStart, setSyncStart] = useState("3days");
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/crm/email-accounts");
      const payload = (await response.json().catch(() => ({}))) as {
        accounts?: CrmEmailAccountDto[];
        error?: string;
      };
      const next = payload.accounts ?? [];
      setAccounts(next);
      setSelectedId((current) => {
        if (current && next.some((account) => account.id === current)) {
          return current;
        }
        return next[0]?.id ?? null;
      });
      if (!response.ok && next.length === 0) {
        setLoadError(payload.error || "Could not load email accounts. Refresh to try again.");
      }
    } catch {
      setAccounts([]);
      setSelectedId(null);
      setLoadError("Could not load email accounts. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    let cancelled = false;
    async function loadGoogleStatus() {
      try {
        const response = await fetch("/api/crm/email-accounts/google/status");
        const payload = (await response.json().catch(() => ({}))) as { configured?: boolean };
        if (!cancelled) {
          setGoogleConfigured(Boolean(payload.configured));
        }
      } catch {
        if (!cancelled) {
          setGoogleConfigured(false);
        }
      }
    }
    void loadGoogleStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const accountId = searchParams.get("accountId");
    const error = searchParams.get("error");
    if (!connected && !error) {
      return;
    }
    if (connected === "1") {
      setBanner({
        tone: "success",
        message: "Google authorization succeeded. Sync is active for this mailbox.",
      });
      if (accountId) {
        setSelectedId(accountId);
      }
      void loadAccounts();
    } else if (error) {
      const message = oauthErrorMessage(error);
      if (message) {
        setBanner({
          tone: error === "google_not_configured" ? "warning" : "error",
          message,
        });
      }
    }
    router.replace("/app/settings/integrations/email");
  }, [loadAccounts, router, searchParams]);

  const selected = accounts.find((account) => account.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setSenderName("");
      setIsDefault(true);
      return;
    }
    setSenderName(selected.senderName ?? "");
    setIsDefault(selected.isDefault);
  }, [selected]);

  const atPersonalLimit = accounts.length >= PERSONAL_EMAIL_ACCOUNT_LIMIT;

  function startGoogleAuthorize(account: CrmEmailAccountDto) {
    const params = new URLSearchParams({
      email: account.email,
      accountId: account.id,
    });
    window.location.assign(`/api/crm/email-accounts/google/start?${params.toString()}`);
  }

  async function disconnectSelectedAccount() {
    if (!selected) {
      return;
    }
    setDisconnecting(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/crm/email-accounts/${selected.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not disconnect email sync.");
      }
      setConfirmDisconnect(false);
      setSelectedId(null);
      setBanner({
        tone: "success",
        message: `Disconnected ${selected.email}. You can connect it again anytime.`,
      });
      await loadAccounts();
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Could not disconnect email sync.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <SheetPage
        toolbar={
          <div className="w-full space-y-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Email sync</h1>
              <p className="mt-0.5 text-sm text-muted">
                Connect Google, Office 365, Exchange, or IMAP so mail syncs into Contacts → Inbox.
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
                Google sign-in for Email Sync needs <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="text-xs">GOOGLE_CLIENT_SECRET</code> in your monorepo{" "}
                <code className="text-xs">.env</code>. Add the redirect URI{" "}
                <code className="text-xs">/api/crm/email-accounts/google/callback</code> in Google Cloud,
                then restart the app.
              </div>
            ) : null}
            {loadError ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadAccounts()}
                  className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-100"
                >
                  Retry
                </button>
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
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="w-full shrink-0 border-b border-border bg-slate-50/60 p-4 lg:w-64 lg:border-b-0 lg:border-r">
              <button
                type="button"
                disabled={atPersonalLimit}
                onClick={() => setWizardOpen(true)}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-base leading-none">+</span>
                Email account
              </button>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Personal · {accounts.length}/{PERSONAL_EMAIL_ACCOUNT_LIMIT}
              </p>
              {loading && accounts.length === 0 ? (
                <p className="px-1 py-3 text-sm text-muted">Loading…</p>
              ) : accounts.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-center">
                  <p className="text-sm text-muted">No account added</p>
                  <p className="mt-1 text-xs text-muted">Google is the default provider.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {accounts.map((account) => {
                    const active = account.id === selectedId;
                    return (
                      <li key={account.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(account.id);
                            setConfirmDisconnect(false);
                          }}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                            active
                              ? "border-primary/30 bg-primary/[0.07]"
                              : "border-transparent bg-white hover:bg-slate-100/80",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              providerAvatarClass(account.provider),
                            )}
                          >
                            {providerInitial(account.provider)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {account.email}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                              <span
                                className={cn(
                                  "inline-block h-1.5 w-1.5 rounded-full",
                                  account.syncStatus === "ACTIVE"
                                    ? "bg-emerald-500"
                                    : account.syncStatus === "ERROR"
                                      ? "bg-red-500"
                                      : "bg-amber-500",
                                )}
                              />
                              {account.syncStatus === "ACTIVE"
                                ? "Sync active"
                                : account.syncStatus === "ERROR"
                                  ? "Sync error"
                                  : "Sync inactive"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Team · 0/1
              </p>
              <p className="text-xs text-muted">No team account added yet.</p>
            </aside>

            <div className="min-w-0 flex-1 space-y-6 p-5">
              {!selected ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Account details</h2>
                  <p className="text-sm text-muted">
                    Add an email account to start syncing inbound and outbound mail into{" "}
                    <Link href="/app/contacts/inbox" className="font-medium text-primary hover:underline">
                      Contacts → Inbox
                    </Link>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setWizardOpen(true)}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                  >
                    + Email account
                  </button>
                </section>
              ) : (
                <>
                  <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-foreground">Account details</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{selected.email}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                          selected.syncStatus === "ACTIVE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : selected.syncStatus === "ERROR"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-amber-200 bg-amber-50 text-amber-800",
                        )}
                      >
                        {selected.syncStatus === "ACTIVE"
                          ? "Sync active"
                          : selected.syncStatus === "ERROR"
                            ? "Sync error"
                            : "Sync inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      Provider:{" "}
                      <span className="font-medium text-foreground">
                        {providerDisplayName(selected.provider)}
                      </span>
                      {selected.provider === "IMAP" && selected.imapHost ? (
                        <>
                          {" "}
                          · IMAP {selected.imapHost}:{selected.imapPort ?? "—"} · SMTP{" "}
                          {selected.smtpHost}:{selected.smtpPort ?? "—"}
                        </>
                      ) : null}
                    </p>
                    <p className="text-sm text-foreground">
                      {selected.syncStatus === "ACTIVE"
                        ? "Mail from this account appears in Contacts → Inbox."
                        : selected.provider === "IMAP"
                          ? "IMAP settings are saved. Live mailbox sync will activate with the sync worker."
                          : selected.provider === "GOOGLE"
                            ? "Google hasn’t authorized SendDox yet. Click Connect with Google to open the consent screen and activate sync."
                            : `${providerDisplayName(selected.provider)} OAuth isn’t available yet. Use Google or Other (IMAP).`}
                    </p>

                    {selected.provider === "GOOGLE" && selected.syncStatus !== "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => startGoogleAuthorize(selected)}
                        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                      >
                        Connect with Google
                      </button>
                    ) : null}

                    {selected.provider === "GOOGLE" && selected.syncStatus === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => startGoogleAuthorize(selected)}
                        className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                      >
                        Reconnect Google
                      </button>
                    ) : null}

                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-foreground">Sender name</span>
                      <input
                        value={senderName}
                        onChange={(event) => setSenderName(event.target.value)}
                        placeholder="Add custom sender name."
                        disabled
                        className="h-9 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-primary/20 placeholder:text-muted/80 focus:border-primary/40 focus:ring-2 disabled:opacity-60"
                      />
                    </label>

                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <span
                        className={cn(
                          "relative h-5 w-9 rounded-full transition-colors",
                          isDefault ? "bg-primary" : "bg-slate-200",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                            isDefault ? "left-4" : "left-0.5",
                          )}
                        />
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isDefault}
                        onChange={(event) => setIsDefault(event.target.checked)}
                        disabled
                      />
                      Default email account
                    </label>
                  </section>

                  <section className="space-y-3 border-t border-border pt-5">
                    <h2 className="text-sm font-semibold text-foreground">Sync past emails</h2>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="space-y-1.5">
                        <span className="block text-sm text-muted">Sync start date</span>
                        <select
                          value={syncStart}
                          onChange={(event) => setSyncStart(event.target.value)}
                          disabled
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60"
                        >
                          <option value="3days">3 days ago</option>
                          <option value="7days">7 days ago</option>
                          <option value="30days">30 days ago</option>
                          <option value="all">All history</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled
                        className="h-9 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground opacity-60"
                      >
                        Sync
                      </button>
                    </div>
                  </section>

                  <section className="space-y-2 border-t border-border pt-5">
                    <h2 className="text-sm font-semibold text-foreground">Signatures</h2>
                    <button type="button" disabled className="text-sm font-medium text-primary opacity-60">
                      + Add signature
                    </button>
                  </section>

                  <section className="space-y-3 border-t border-border pt-5">
                    <h2 className="text-sm font-semibold text-foreground">Advanced settings</h2>
                    <div className="max-w-xl rounded-md border border-border bg-slate-50/70 px-4 py-4">
                      <p className="text-sm font-medium text-foreground">Disconnect Email Sync</p>
                      <p className="mt-1 text-sm text-muted">
                        Removes this mailbox from SendDox and clears stored Google/IMAP credentials.
                        Synced message history in Inbox may remain until cleaned up separately.
                      </p>
                      {!confirmDisconnect ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDisconnect(true)}
                          className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Disconnect Email Sync
                        </button>
                      ) : (
                        <div className="mt-3 space-y-3 rounded-md border border-red-200 bg-red-50 px-3 py-3">
                          <p className="text-sm text-red-950">
                            Disconnect <span className="font-medium">{selected.email}</span>? This stops
                            syncing with SendDox until you connect again.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={disconnecting}
                              onClick={() => void disconnectSelectedAccount()}
                              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {disconnecting ? "Disconnecting…" : "Yes, disconnect"}
                            </button>
                            <button
                              type="button"
                              disabled={disconnecting}
                              onClick={() => setConfirmDisconnect(false)}
                              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {TABS.find((item) => item.id === tab)?.label}
            </h2>
            <p className="text-sm text-muted">
              This section will be available after you connect an email account.
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

      <EmailAccountConnectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConnected={(account) => {
          setSelectedId(account.id);
          void loadAccounts();
        }}
      />
    </>
  );
}
