"use client";

import { useState, type FormEvent } from "react";

const fieldClass =
  "w-full rounded-none border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function PasswordChangeCard({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { email?: string; error?: { message?: string } }
        | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to start the password change.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        `Check ${payload?.email ?? email} for a confirmation link. Your password will not change until you confirm (link expires in 30 minutes).`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMessage(`If your email is verified, a password reset link was sent to ${email}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="password" className="mt-10 max-w-lg scroll-mt-28 border-t border-border pt-6">
      <h2 className="text-sm font-semibold text-foreground">Password</h2>
      <p className="mt-1 text-sm text-muted">
        For your security, we email you a link to confirm before your password changes.
      </p>
      <form className="mt-4 space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Current password</span>
          <input
            className={fieldClass}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">New password</span>
          <input
            className={fieldClass}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            required
          />
          <span className="mt-1 block text-xs text-muted">Use at least 15 characters.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Confirm new password</span>
          <input
            className={fieldClass}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            required
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700" role="status">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Change password"}
          </button>
          <button
            type="button"
            onClick={() => void sendResetLink()}
            disabled={busy || !email}
            className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-60"
          >
            Forgot your current password? Email me a reset link
          </button>
        </div>
      </form>
    </section>
  );
}
