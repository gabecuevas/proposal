"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function VerifyEmailConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    void fetch(`/api/auth/verify-email/confirm?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { status?: { valid?: boolean } };
        setStatus(payload.status?.valid ? "ready" : "invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function confirm() {
    if (!token) {
      return;
    }
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/auth/verify-email/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { redirectHint?: string; error?: { message?: string } }
      | null;
    setSubmitting(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to verify email");
      return;
    }
    setStatus("done");
    router.push(payload?.redirectHint ?? "/onboarding/company");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <h1 className="text-3xl font-semibold">Confirm your email</h1>
      {status === "loading" ? <p className="mt-3 text-sm text-muted">Checking your link…</p> : null}
      {status === "invalid" ? (
        <p className="mt-3 text-sm text-red-600">
          This verification link is invalid or expired.{" "}
          <Link href="/verify-email" className="text-primary underline-offset-4 hover:underline">
            Request a new one
          </Link>
          .
        </p>
      ) : null}
      {status === "ready" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted">Click verify to finish confirming your email address.</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void confirm()}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Verifying..." : "Verify email"}
          </button>
        </div>
      ) : null}
      {status === "done" ? <p className="mt-3 text-sm text-emerald-700">Email verified. Redirecting…</p> : null}
    </main>
  );
}
