"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { OnboardingProgress } from "@/components/auth/onboarding-progress";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const oauthError = searchParams.get("error");

  const googleConfigured = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        fullName,
        email,
        password,
        companyName,
        acceptTerms,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to create account");
      setLoading(false);
      return;
    }

    router.push("/verify-email");
    router.refresh();
  }

  const oauthErrorMessage =
    oauthError === "google_not_configured"
      ? "Google sign-in is not configured yet."
      : oauthError === "google_account_exists"
        ? "An account with this email already exists. Log in with your password or use a different Google account."
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
          <OnboardingProgress active="Account" className="mb-6" />
          <h1 className="text-3xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-muted">Start your SendDox workspace in a few minutes.</p>
          {oauthErrorMessage ? <p className="mt-4 text-sm text-red-600">{oauthErrorMessage}</p> : null}
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <input
              className="w-full rounded-none border border-border bg-surface px-4 py-3 text-sm"
              placeholder="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <input
              className="w-full rounded-none border border-border bg-surface px-4 py-3 text-sm"
              placeholder="Work email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <div className="relative">
              <input
                className="w-full rounded-none border border-border bg-surface px-4 py-3 pr-20 text-sm"
                placeholder="Password (15+ characters)"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={15}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              className="w-full rounded-none border border-border bg-surface px-4 py-3 text-sm"
              placeholder="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
            />
            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
            {googleConfigured ? (
              <a
                className="block w-full rounded-none border border-border px-4 py-3 text-center text-sm font-medium hover:bg-surface"
                href="/api/auth/google/start?next=%2Fverify-email"
              >
                Continue with Google
              </a>
            ) : null}
          </form>
          <p className="mt-4 text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
