export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Last 7 digits used for indexed-ish phone candidate lookup. */
export function phoneSearchSuffix(value: string): string | null {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 7) {
    return null;
  }
  return digits.slice(-7);
}

export function phonesEquivalent(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db || da.length < 7 || db.length < 7) {
    return false;
  }
  if (da === db) {
    return true;
  }
  const minLen = Math.min(da.length, db.length, 10);
  return da.slice(-minLen) === db.slice(-minLen);
}
