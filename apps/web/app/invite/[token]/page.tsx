"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

type InvitePreview = {
  email: string;
  role: string;
  workspaceName: string;
};

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch(`/api/invite/${encodeURIComponent(params.token)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          invite?: InvitePreview;
          error?: { message?: string };
        };
        if (!response.ok) {
          setError(payload.error?.message ?? "Invitation not found");
          return;
        }
        setInvite(payload.invite ?? null);
      })
      .catch(() => setError("Unable to load invitation"));
  }, [params.token]);

  async function accept() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/invite/${encodeURIComponent(params.token)}`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as
      | { redirectHint?: string; error?: { message?: string } }
      | null;
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to accept invitation");
      return;
    }
    router.push(payload?.redirectHint ?? "/app");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <h1 className="text-3xl font-semibold">Workspace invitation</h1>
      {invite ? (
        <p className="mt-3 text-sm text-muted">
          You&apos;ve been invited to join <strong>{invite.workspaceName}</strong> as{" "}
          <strong>{invite.role.toLowerCase()}</strong> ({invite.email}).
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={loading || !invite}
          onClick={() => void accept()}
          className="w-full rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Accepting..." : "Accept invitation"}
        </button>
        <Link
          href="/login"
          className="block w-full rounded-none border border-border px-4 py-3 text-center text-sm font-medium hover:bg-surface"
        >
          Sign in with another account
        </Link>
      </div>
    </main>
  );
}
