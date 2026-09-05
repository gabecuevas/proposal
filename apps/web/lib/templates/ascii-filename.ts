/** Strip non-ASCII for HTTP header values that must be ByteStrings. */
export function asciiFilename(value: string, fallback = "document"): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s.\-()]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

export function asciiTitle(value: string, fallback = "Document"): string {
  return asciiFilename(value, fallback);
}
