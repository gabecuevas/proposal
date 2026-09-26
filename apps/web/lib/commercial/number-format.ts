export type DocumentNumberFormat = {
  prefix: string;
  suffix: string;
  padWidth: number;
};

export type ParsedDocumentNumber = DocumentNumberFormat & { value: number };

const MAX_SEQUENCE_VALUE = 999_999_999;

/**
 * Splits a user-entered number into prefix / numeric part / suffix, using the
 * last run of digits: "SD-0034" → { prefix: "SD-", value: 34, padWidth: 4 }.
 * Returns null when there are no digits to increment ("DRAFT").
 */
export function parseDocumentNumber(input: string): ParsedDocumentNumber | null {
  const trimmed = input.trim();
  const match = /^(.*?)(\d+)(\D*)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const digits = match[2]!;
  const value = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(value) || value > MAX_SEQUENCE_VALUE) {
    return null;
  }
  return {
    prefix: match[1]!,
    suffix: match[3]!,
    padWidth: digits.length > 1 && digits.startsWith("0") ? digits.length : 0,
    value,
  };
}

export function formatDocumentNumber(value: number, format: DocumentNumberFormat): string {
  const digits = format.padWidth > 0 ? String(value).padStart(format.padWidth, "0") : String(value);
  return `${format.prefix}${digits}${format.suffix}`;
}

export function sameNumberSeries(a: DocumentNumberFormat, b: DocumentNumberFormat): boolean {
  return a.prefix === b.prefix && a.suffix === b.suffix;
}
