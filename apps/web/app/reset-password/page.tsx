"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { redirectHint?: string; error?: { message?: string } }
      | null;
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to reset password");
      return;
    }
    router.push(payload?.redirectHint ?? "/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">Use at least 15 characters.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
          placeholder="New password"
          type="password"
          minLength={15}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>
      {!token ? (
        <p className="mt-4 text-sm text-red-600">
          Missing reset token.{" "}
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Request a new link
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
