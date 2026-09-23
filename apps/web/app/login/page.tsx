"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const oauthError = searchParams.get("error");
  const next = searchParams.get("next");

  const googleConfigured = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password, next }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to log in");
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { redirectHint?: string };
    router.push(payload.redirectHint ?? "/app");
    router.refresh();
  }

  async function bootstrapLocalDemo() {
    setError("");
    setBootstrapLoading(true);
    const response = await fetch("/api/auth/dev-bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to bootstrap local demo user");
      setBootstrapLoading(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  const oauthErrorMessage =
    oauthError === "google_not_configured"
      ? "Google sign-in is not configured yet."
      : oauthError === "google_account_exists"
        ? "This email is registered with a password. Log in with email and password."
        : oauthError
          ? "Google sign-in failed. Please try again."
          : "";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthMarketingPanel />
      <div className="flex flex-col justify-center px-6 py-10 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <SendDoxLogo className="h-8" />
          </div>
          <h1 className="text-3xl font-semibold">Log in to SendDox</h1>
          <p className="mt-2 text-sm text-muted">Access your workspace and continue editing documents.</p>
          {oauthErrorMessage ? <p className="mt-4 text-sm text-red-600">{oauthErrorMessage}</p> : null}
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => void bootstrapLocalDemo()}
              disabled={bootstrapLoading}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-surface disabled:opacity-60"
            >
              {bootstrapLoading ? "Preparing local demo..." : "Use local demo account"}
            </button>
            {googleConfigured ? (
              <a
                className="block w-full rounded-lg border border-border px-4 py-3 text-center text-sm font-medium hover:bg-surface"
                href={`/api/auth/google/start?next=${encodeURIComponent(next && next.startsWith("/") ? next : "/app")}`}
              >
                Continue with Google
              </a>
            ) : null}
          </form>
          <p className="mt-4 text-sm text-muted">
            New here?{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
