"use client";

import { useEffect, useState, type FormEvent } from "react";
import { OnboardingProgress } from "@/components/auth/onboarding-progress";
import { SendDoxLogo } from "@/components/brand/senddox-logo";
import { LogoutButton } from "@/components/auth/logout-button";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void refreshSession();
    const interval = window.setInterval(() => {
      void refreshSession(true);
    }, 8000);
    return () => window.clearInterval(interval);
  }, []);

  async function refreshSession(redirectIfVerified = false) {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      user?: {
        email?: string;
        pending_email?: string | null;
        emailVerified?: boolean;
        companySetupComplete?: boolean;
        teamStepComplete?: boolean;
        workspaceId?: string | null;
      };
    };
    setEmail(payload.user?.email ?? "");
    setPendingEmail(payload.user?.pending_email ?? null);
    if (redirectIfVerified && payload.user?.emailVerified) {
      if (!payload.user.workspaceId || !payload.user.companySetupComplete) {
        window.location.href = "/onboarding/company";
      } else if (!payload.user.teamStepComplete) {
        window.location.href = "/onboarding/team";
      } else {
        window.location.href = "/app";
      }
    }
  }

  async function resend() {
    setLoading(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
      credentials: "same-origin",
    });
    setLoading(false);
    if (response.ok) {
      setMessage("Verification email sent. Check your inbox.");
    } else if (response.status === 429) {
      setError("Please wait a minute before requesting another email.");
    } else {
      setError("Unable to resend right now. Try again shortly.");
    }
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/change-pending-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: newEmail, password }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to change email");
      return;
    }
    setChangingEmail(false);
    setPassword("");
    setMessage("Email updated. Check your inbox for a new verification link.");
    await refreshSession();
  }

  const displayEmail = pendingEmail ?? email;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <OnboardingProgress active="Verify" className="mb-6" />
      <h1 className="text-3xl font-semibold">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted">
        Verify your email to continue. We sent a verification link to{" "}
        <span className="font-medium text-foreground">{displayEmail || "your email"}</span>.
      </p>
      {message ? (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!changingEmail ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void resend()}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Sending..." : "Resend email"}
          </button>
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface"
          >
            Change email
          </button>
          <LogoutButton className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface" />
        </div>
      ) : (
        <form className="mt-8 space-y-3" onSubmit={(event) => void changeEmail(event)}>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">New email</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Confirm with password</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update email"}
            </button>
            <button
              type="button"
              onClick={() => setChangingEmail(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
