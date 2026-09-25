export type IpLocation = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
};

function header(headers: Headers, name: string): string | null {
  const raw = headers.get(name)?.trim();
  if (!raw) {
    return null;
  }
  try {
    return decodeURIComponent(raw).slice(0, 120);
  } catch {
    return raw.slice(0, 120);
  }
}

/** Vercel edge geo headers; absent locally, so callers must treat null as "unknown". */
export function ipLocationFromHeaders(headers: Headers): IpLocation | null {
  const location: IpLocation = {
    city: header(headers, "x-vercel-ip-city"),
    region: header(headers, "x-vercel-ip-country-region"),
    country: header(headers, "x-vercel-ip-country"),
    timezone: header(headers, "x-vercel-ip-timezone"),
  };
  return location.city || location.country || location.timezone ? location : null;
}

export function ipLocationUserData(location: IpLocation | null | undefined) {
  if (!location) {
    return {};
  }
  return {
    city: location.city,
    city_source: "ip",
    ip_region: location.region,
    ip_country: location.country,
    ip_timezone: location.timezone,
    location_updated_at: new Date(),
  };
}

export function formatIpCity(input: {
  city: string | null;
  region: string | null;
  country: string | null;
}): string {
  const parts = [input.city, input.region, input.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}
