"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function ConfirmPasswordChangePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function confirm() {
    setState("saving");
    setError("");
    const response = await fetch("/api/auth/password-change/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Unable to confirm the password change.");
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      {state === "done" ? (
        <>
          <h1 className="text-3xl font-semibold">Password changed</h1>
          <p className="mt-2 text-sm text-muted">
            Your new password is active. Use it the next time you sign in.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-flex justify-center rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            Continue to SendDox
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Confirm password change</h1>
          <p className="mt-2 text-sm text-muted">
            Your password will not change until you confirm. If you did not request this, close this page and
            reset your password.
          </p>
          {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!token || state === "saving"}
            className="mt-8 w-full rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {state === "saving" ? "Confirming..." : "Confirm password change"}
          </button>
          {!token ? <p className="mt-4 text-sm text-red-600">Missing confirmation token.</p> : null}
        </>
      )}
    </main>
  );
}
