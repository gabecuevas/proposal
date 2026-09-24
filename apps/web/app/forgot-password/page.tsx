"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (response.ok) {
      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? "Check your email for reset instructions.");
    } else {
      setMessage("Unable to process request right now.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-muted">We&apos;ll email you a secure link to choose a new password.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-none border border-border bg-surface px-4 py-3 text-sm"
          placeholder="Work email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to login
        </Link>
      </p>
    </main>
  );
}
