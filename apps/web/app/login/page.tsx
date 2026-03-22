"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

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
  const nextPath = next && next.startsWith("/") ? next : "/app";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to log in");
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  async function bootstrapLocalDemo() {
    setError("");
    setBootstrapLoading(true);
    const response = await fetch("/api/auth/dev-bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      : oauthError
        ? "Google sign-in failed. Please try again."
        : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold">Log in to DoxySign</h1>
        <p className="mt-2 text-muted">Access your workspace and continue editing documents.</p>
        {oauthErrorMessage ? <p className="mt-4 text-sm text-red-600">{oauthErrorMessage}</p> : null}
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-border bg-surface px-4 py-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-border bg-surface px-4 py-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => void bootstrapLocalDemo()}
          disabled={bootstrapLoading}
          className="w-full rounded-lg border border-border px-4 py-3 font-medium hover:bg-surface disabled:opacity-60"
        >
          {bootstrapLoading ? "Preparing local demo..." : "Use local demo account"}
        </button>
        <a
          className="block w-full rounded-lg border border-border px-4 py-3 text-center font-medium hover:bg-surface"
          href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}
        >
          Continue with Google
        </a>
        </form>
        <p className="mt-4 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
        </p>
      </div>
    </main>
  );
}
