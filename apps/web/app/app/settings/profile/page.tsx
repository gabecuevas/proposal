"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SheetPadded } from "@/components/ui/sheet-table";
import { assetUrl } from "@/lib/storage/asset-url";

/** On-screen avatar diameter (CSS pixels). */
export const PROFILE_AVATAR_DISPLAY_PX = 96;
/** Suggested square upload for crisp retina (2× display). */
export const PROFILE_AVATAR_SUGGESTED_PX = 256;
export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  personalTimezone: string | null;
  avatarAssetKey: string | null;
  avatarUrl: string | null;
  companyName: string;
  domainName: string;
  noWebsite: boolean;
  role: string | null;
};

const fieldClass =
  "w-full rounded-none border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export default function SettingsProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [domainName, setDomainName] = useState("");
  const [noWebsite, setNoWebsite] = useState(false);
  const [personalTimezone, setPersonalTimezone] = useState("");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    const response = await fetch("/api/auth/profile", { credentials: "same-origin" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { profile?: Profile };
    const next = payload.profile;
    if (!next) {
      return;
    }
    setProfile(next);
    setName(next.name ?? "");
    setEmail(next.email ?? "");
    setPhone(next.phone ?? "");
    setCompanyName(next.companyName ?? "");
    setDomainName(next.domainName ?? "");
    setNoWebsite(Boolean(next.noWebsite));
    setPersonalTimezone(
      next.personalTimezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "America/Los_Angeles",
    );
    setAvatarKey(next.avatarAssetKey);
    setAvatarPreview(next.avatarUrl);
  }

  async function onPickAvatar(file: File | undefined) {
    if (!file) {
      return;
    }
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setError("Profile picture must be 2MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body, credentials: "same-origin" });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const payload = (await response.json()) as { upload?: { key?: string; url?: string } };
      const key = payload.upload?.key;
      if (!key) {
        throw new Error("Upload response missing key");
      }
      setAvatarKey(key);
      setAvatarPreview(payload.upload?.url ?? assetUrl(key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        name,
        phone,
        personalTimezone,
        avatarAssetKey: avatarKey,
        companyName,
        domainName: noWebsite ? null : domainName,
        noWebsite,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to save profile");
      return;
    }
    const payload = (await response.json()) as { profile?: Profile };
    if (payload.profile) {
      setProfile(payload.profile);
      setAvatarPreview(payload.profile.avatarUrl);
      setAvatarKey(payload.profile.avatarAssetKey);
      setDomainName(payload.profile.domainName ?? "");
      setNoWebsite(Boolean(payload.profile.noWebsite));
    }
    setMessage("Profile saved.");
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const canEditCompany = profile?.role === "OWNER" || profile?.role === "ADMIN";

  return (
    <SheetPadded>
      <h1 className="text-sm font-semibold text-foreground">Profile</h1>
      <p className="mt-2 text-sm text-muted">
        Your account identity and signup details used across SendDox workspaces.
      </p>
      <form className="mt-6 max-w-lg space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <span className="mb-2 block text-sm text-muted">Profile picture</span>
          <div className="flex items-start gap-4">
            <div
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-slate-100 text-sm font-semibold text-muted"
              style={{ width: PROFILE_AVATAR_DISPLAY_PX, height: PROFILE_AVATAR_DISPLAY_PX }}
              aria-hidden={!avatarPreview}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt=""
                  width={PROFILE_AVATAR_DISPLAY_PX}
                  height={PROFILE_AVATAR_DISPLAY_PX}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials || "—"
              )}
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-muted">
                Shown as a <span className="font-medium text-foreground">circle</span> at{" "}
                {PROFILE_AVATAR_DISPLAY_PX}×{PROFILE_AVATAR_DISPLAY_PX}px. Upload a{" "}
                <span className="font-medium text-foreground">square</span> image — recommended{" "}
                {PROFILE_AVATAR_SUGGESTED_PX}×{PROFILE_AVATAR_SUGGESTED_PX}px (PNG, JPEG, or WebP,
                max 2MB). Non-square images are cropped to center; they are never stretched.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  void onPickAvatar(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-none border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Change photo"}
                </button>
                {avatarKey ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarKey(null);
                      setAvatarPreview(null);
                    }}
                    className="rounded-none border border-border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Full name</span>
          <input
            className={fieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input className={fieldClass} value={email} readOnly autoComplete="email" />
          <span className="mt-1 block text-xs text-muted">
            Email changes require a secure verification flow.
          </span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Company name</span>
          <input
            className={fieldClass}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            disabled={!canEditCompany}
            required
            minLength={2}
          />
          {!canEditCompany ? (
            <span className="mt-1 block text-xs text-muted">
              Only owners and admins can change the company name.
            </span>
          ) : null}
        </label>

        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Domain name</span>
            <input
              className={`${fieldClass} disabled:opacity-50`}
              placeholder="https://acme.example"
              value={domainName}
              onChange={(event) => setDomainName(event.target.value)}
              disabled={!canEditCompany || noWebsite}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={noWebsite}
              disabled={!canEditCompany}
              onChange={(event) => setNoWebsite(event.target.checked)}
            />
            I don&apos;t have a website
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Phone</span>
          <input
            className={fieldClass}
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+1 555 000 0000"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Time zone</span>
          <input
            className={fieldClass}
            value={personalTimezone}
            onChange={(event) => setPersonalTimezone(event.target.value)}
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

        <button
          type="submit"
          disabled={loading || uploading}
          className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </SheetPadded>
  );
}
