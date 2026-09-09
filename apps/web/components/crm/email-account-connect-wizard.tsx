"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@repo/ui/utils";
import type { CrmEmailAccountDto, EmailSyncProviderId } from "@/lib/crm/emails";

type WizardStep = 1 | 2 | 3;

type EmailAccountConnectWizardProps = {
  open: boolean;
  onClose: () => void;
  onConnected: (account: CrmEmailAccountDto) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDERS: Array<{
  id: EmailSyncProviderId;
  label: string;
  kind: "oauth" | "imap";
}> = [
  { id: "GOOGLE", label: "Google", kind: "oauth" },
  { id: "OFFICE365", label: "Office 365", kind: "oauth" },
  { id: "EXCHANGE", label: "Exchange", kind: "oauth" },
  { id: "IMAP", label: "Other", kind: "imap" },
];

function providerLabel(id: EmailSyncProviderId): string {
  return PROVIDERS.find((item) => item.id === id)?.label ?? id;
}

function GoogleMark() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[15px] font-semibold tracking-tight">
      <span className="text-[#4285F4]">G</span>
      <span className="text-[#EA4335]">o</span>
      <span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span>
      <span className="text-[#34A853]">l</span>
      <span className="text-[#EA4335]">e</span>
    </span>
  );
}

function OfficeMark() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#D83B01]">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#D83B01" />
        <path d="M7 7h6v3H10v7H7V7zm7 3h4v7h-4v-7z" fill="#fff" />
      </svg>
      Office 365
    </span>
  );
}

function ExchangeMark() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#0078D4]">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" fill="#0078D4" />
        <path d="M6 8h12v2H6V8zm0 4h8v2H6v-2z" fill="#fff" />
      </svg>
      Exchange
    </span>
  );
}

function ProviderGlyph({ id }: { id: EmailSyncProviderId }) {
  if (id === "GOOGLE") {
    return <GoogleMark />;
  }
  if (id === "OFFICE365") {
    return <OfficeMark />;
  }
  if (id === "EXCHANGE") {
    return <ExchangeMark />;
  }
  return <span className="text-[15px] font-semibold text-foreground">Other</span>;
}

function fieldClassName() {
  return "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none ring-primary/20 placeholder:text-muted/70 focus:border-primary/40 focus:ring-2";
}

export function EmailAccountConnectWizard({
  open,
  onClose,
  onConnected,
}: EmailAccountConnectWizardProps) {
  const titleId = useId();
  const [step, setStep] = useState<WizardStep>(1);
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<EmailSyncProviderId | null>(null);
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setEmail("");
    setProvider(null);
    setPassword("");
    setImapHost("");
    setImapPort("993");
    setSmtpHost("");
    setSmtpPort("587");
    setBusy(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  const oauthProvider = provider && provider !== "IMAP" ? provider : null;
  const title =
    step === 1
      ? "Connect email account"
      : step === 2
        ? "Choose your email provider"
        : oauthProvider
          ? `Connect with ${providerLabel(oauthProvider)}`
          : "Connect email account";

  async function submitAccount(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        account?: CrmEmailAccountDto;
      };
      if (!response.ok || !body.account) {
        throw new Error(body.error || "Could not connect email account");
      }
      onConnected(body.account);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect email account");
    } finally {
      setBusy(false);
    }
  }

  function goToProviderStep() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setEmail(trimmed);
    setError(null);
    setStep(2);
  }

  function selectProvider(next: EmailSyncProviderId) {
    setProvider(next);
    setError(null);
    if (next === "IMAP") {
      setImapHost((value) => value || guessImapHost(email));
      setSmtpHost((value) => value || guessSmtpHost(email));
    }
    setStep(3);
  }

  return (
    <div
      className="app-theme fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-20 sm:pt-24"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted">Step {step} of 3</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-slate-50 hover:text-foreground disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {step === 1 ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                goToProviderStep();
              }}
            >
              <p className="text-sm text-muted">
                Enter the address you want to sync into Contacts → Inbox. Google is recommended when
                available; Office 365, Exchange, and IMAP are also supported.
              </p>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className={fieldClassName()}
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                >
                  Continue
                </button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Connecting <span className="font-medium text-foreground">{email}</span>
              </p>
              <div className="space-y-2.5">
                {PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProvider(item.id)}
                    className="flex h-14 w-full items-center justify-center rounded-lg border border-border bg-white px-4 transition-colors hover:border-primary/40 hover:bg-slate-50"
                  >
                    <ProviderGlyph id={item.id} />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                >
                  <span aria-hidden>‹</span> Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 && oauthProvider ? (
            <div className="space-y-4">
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
                <p>
                  {oauthProvider === "GOOGLE"
                    ? "Google will ask you to allow SendDox to send and receive mail for this address. We never store your Google password."
                    : `${providerLabel(oauthProvider)} OAuth will be available soon. Google is ready to connect now.`}
                </p>
              </div>
              <div className="rounded-md border border-border bg-slate-50 px-3 py-3 text-sm">
                <p className="text-muted">Account</p>
                <p className="font-medium text-foreground">{email}</p>
                <div className="mt-3">
                  <ProviderGlyph id={oauthProvider} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                >
                  <span aria-hidden>‹</span> Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || oauthProvider !== "GOOGLE"}
                    onClick={() => {
                      if (oauthProvider !== "GOOGLE") {
                        setError("Only Google OAuth is available right now. Choose Google or Other (IMAP).");
                        return;
                      }
                      setBusy(true);
                      setError(null);
                      // Full-page redirect into Google consent (popup-free, reliable with cookies).
                      window.location.assign(
                        `/api/crm/email-accounts/google/start?email=${encodeURIComponent(email)}`,
                      );
                    }}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
                  >
                    {busy
                      ? "Opening Google…"
                      : oauthProvider === "GOOGLE"
                        ? "Continue with Google"
                        : `${providerLabel(oauthProvider)} coming soon`}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 && provider === "IMAP" ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!password.trim()) {
                  setError("Enter your email password or app password.");
                  return;
                }
                if (!imapHost.trim() || !smtpHost.trim()) {
                  setError("Enter both IMAP and SMTP server hosts.");
                  return;
                }
                const imapPortNum = Number(imapPort);
                const smtpPortNum = Number(smtpPort);
                if (!Number.isInteger(imapPortNum) || imapPortNum < 1 || imapPortNum > 65535) {
                  setError("Enter a valid IMAP port.");
                  return;
                }
                if (!Number.isInteger(smtpPortNum) || smtpPortNum < 1 || smtpPortNum > 65535) {
                  setError("Enter a valid SMTP port.");
                  return;
                }
                void submitAccount({
                  email,
                  provider: "IMAP",
                  authMethod: "imap",
                  username: email,
                  password,
                  imapHost: imapHost.trim(),
                  imapPort: imapPortNum,
                  smtpHost: smtpHost.trim(),
                  smtpPort: smtpPortNum,
                });
              }}
            >
              <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
                <p>
                  We recommend using an alternative email provider instead of IMAP to ensure reliable
                  email sync.{" "}
                  <span className="font-medium text-primary">Learn more</span>
                </p>
                <p>
                  <span className="font-medium text-primary">
                    Learn more about credentials required for email accounts
                  </span>
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Username</span>
                <input type="email" value={email} readOnly className={cn(fieldClassName(), "bg-slate-50")} />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className={fieldClassName()}
                />
              </label>

              <div className="grid grid-cols-[1fr_88px] gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Incoming server (IMAP)</span>
                  <input
                    value={imapHost}
                    onChange={(event) => setImapHost(event.target.value)}
                    placeholder="imap.example.com"
                    className={fieldClassName()}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Port</span>
                  <input
                    value={imapPort}
                    onChange={(event) => setImapPort(event.target.value)}
                    inputMode="numeric"
                    className={fieldClassName()}
                  />
                </label>
              </div>

              <div className="grid grid-cols-[1fr_88px] gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Outgoing server (SMTP)</span>
                  <input
                    value={smtpHost}
                    onChange={(event) => setSmtpHost(event.target.value)}
                    placeholder="smtp.example.com"
                    className={fieldClassName()}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Port</span>
                  <input
                    value={smtpPort}
                    onChange={(event) => setSmtpPort(event.target.value)}
                    inputMode="numeric"
                    className={fieldClassName()}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                >
                  <span aria-hidden>‹</span> Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function guessImapHost(address: string): string {
  const domain = address.split("@")[1];
  return domain ? `imap.${domain}` : "";
}

function guessSmtpHost(address: string): string {
  const domain = address.split("@")[1];
  return domain ? `smtp.${domain}` : "";
}
