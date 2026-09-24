"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { OnboardingProgress } from "@/components/auth/onboarding-progress";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const [operationId] = useState(() => crypto.randomUUID());
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [noWebsite, setNoWebsite] = useState(false);
  const [companySize, setCompanySize] = useState("");
  const [country, setCountry] = useState("US");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
  );
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/onboarding-status", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          provisionalCompanyName?: string | null;
          user?: { provisional_company_name?: string | null };
        };
        const name = payload.provisionalCompanyName ?? payload.user?.provisional_company_name;
        if (name) {
          setCompanyName(name);
        }
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/onboarding/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        companyName,
        website,
        noWebsite,
        companySize: companySize || null,
        country,
        timezone,
        currency,
        onboardingOperationId: operationId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to save company profile");
      setLoading(false);
      return;
    }

    router.push("/onboarding/team");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <OnboardingProgress active="Company" className="mb-6" />
      <h1 className="text-3xl font-semibold">Set up your company</h1>
      <p className="mt-2 text-sm text-muted">
        Tell us a bit about your company to personalize your experience.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Company name</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Company website</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm disabled:opacity-50"
            placeholder="https://acme.example"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            disabled={noWebsite}
            required={!noWebsite}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={noWebsite}
            onChange={(event) => setNoWebsite(event.target.checked)}
          />
          I don&apos;t have a website
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Company size (optional)</span>
          <select
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            value={companySize}
            onChange={(event) => setCompanySize(event.target.value)}
          >
            <option value="">Select…</option>
            <option value="just_me">Just me</option>
            <option value="2_10">2 – 10 employees</option>
            <option value="11_50">11 – 50 employees</option>
            <option value="51_200">51 – 200 employees</option>
            <option value="201_500">201 – 500 employees</option>
            <option value="501_plus">501+</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Country</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Default currency</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              required
            >
              <option value="USD">USD (US Dollar)</option>
              <option value="CAD">CAD (Canadian Dollar)</option>
              <option value="GBP">GBP (Pound Sterling)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="AUD">AUD (Australian Dollar)</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Time zone</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </main>
  );
}
