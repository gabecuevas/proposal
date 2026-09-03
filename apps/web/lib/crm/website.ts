export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return trimmed;
    }
    const host = formatWebsiteHost(url.hostname);
    const port =
      url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
    const path =
      url.pathname && url.pathname !== "/"
        ? `${url.pathname}${url.search}${url.hash}`
        : "";
    return `${host}${port}${path}`;
  } catch {
    return trimmed;
  }
}

export function websiteHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function formatWebsiteHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.startsWith("www.")) {
    return host;
  }
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 2) {
    return `www.${host}`;
  }
  return host;
}
