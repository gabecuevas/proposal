import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const serialized = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",");
  return `{${serialized}}`;
}

export function computeAuditChecksum(input: {
  workspaceId: string;
  type: string;
  before?: string;
  rows: unknown[];
}) {
  const canonical = stableStringify({
    workspaceId: input.workspaceId,
    type: input.type,
    before: input.before ?? null,
    rows: input.rows,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
