/**
 * Validate and normalize a company website for storage.
 * Accepts bare domains (acme.com → https://acme.com). Rejects credentials,
 * non-http(s) schemes, localhost, and private IP literals. Does not fetch.
 */
export function validateCompanyWebsite(raw: string): { ok: true; href: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Website is required" };
  }
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid website URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Website must use http or https" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Website must not include credentials" };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return { ok: false, error: "Website must be a public host" };
  }
  if (isPrivateIpLiteral(host)) {
    return { ok: false, error: "Website must be a public host" };
  }
  return { ok: true, href: url.toString().replace(/\/$/, "") };
}

function isPrivateIpLiteral(host: string): boolean {
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map((p) => Number(p));
    if (parts.some((n) => n > 255)) {
      return true;
    }
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (host.includes(":")) {
    const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) {
      return true;
    }
  }
  return false;
}

const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "www",
  "admin",
  "settings",
  "login",
  "signup",
  "invite",
  "onboarding",
  "senddox",
  "static",
  "assets",
]);

export function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const candidate = base || "workspace";
  if (RESERVED_SLUGS.has(candidate)) {
    return `${candidate}-co`;
  }
  return candidate;
}
