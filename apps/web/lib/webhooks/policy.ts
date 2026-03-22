import net from "node:net";

export function parseAndValidateAllowedIps(input: unknown): string[] | null {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  for (const ip of normalized) {
    if (net.isIP(ip) === 0) {
      return null;
    }
  }
  return [...new Set(normalized)];
}
