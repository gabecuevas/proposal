import { validatePhone } from "@/lib/crm/contact-field-validation";

export const PHONE_TYPES = ["home", "work", "mobile"] as const;
export type PhoneType = (typeof PHONE_TYPES)[number];

export type PhoneEntry = {
  id: string;
  number: string;
  type: PhoneType;
  primary: boolean;
};

export const PHONE_TYPE_OPTIONS: Array<{ value: PhoneType; label: string }> = [
  { value: "home", label: "Home" },
  { value: "work", label: "Work" },
  { value: "mobile", label: "Mobile" },
];

export function phoneTypeLabel(type: PhoneType): string {
  return PHONE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Work";
}

export function createPhoneId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isPhoneType(value: unknown): value is PhoneType {
  return value === "home" || value === "work" || value === "mobile";
}

export function emptyPhoneEntry(overrides?: Partial<PhoneEntry>): PhoneEntry {
  return {
    id: createPhoneId(),
    number: "",
    type: "work",
    primary: true,
    ...overrides,
  };
}

/** Normalize stored JSON + optional legacy scalar into a sorted phone list (primary first). */
export function parsePhones(value: unknown, legacyPhone?: string | null): PhoneEntry[] {
  const legacy = legacyPhone?.trim() || "";
  const raw = Array.isArray(value) ? value : [];
  const parsed: PhoneEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const number = typeof row.number === "string" ? row.number.trim() : "";
    if (!number) {
      continue;
    }
    parsed.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id : createPhoneId(),
      number,
      type: isPhoneType(row.type) ? row.type : "work",
      primary: Boolean(row.primary),
    });
  }

  if (parsed.length === 0) {
    if (!legacy) {
      return [];
    }
    return [
      {
        id: createPhoneId(),
        number: legacy,
        type: "work",
        primary: true,
      },
    ];
  }

  return normalizePhones(parsed);
}

/** Ensure exactly one primary (first non-empty if none), drop blank numbers, primary first. */
export function normalizePhones(entries: PhoneEntry[]): PhoneEntry[] {
  const cleaned = entries
    .map((entry) => ({
      ...entry,
      id: entry.id?.trim() || createPhoneId(),
      number: entry.number.trim(),
      type: isPhoneType(entry.type) ? entry.type : ("work" as PhoneType),
    }))
    .filter((entry) => entry.number.length > 0);

  if (cleaned.length === 0) {
    return [];
  }

  const primaryIndex = cleaned.findIndex((entry) => entry.primary);
  const resolvedIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const normalized = cleaned.map((entry, index) => ({
    ...entry,
    primary: index === resolvedIndex,
  }));

  return [
    ...normalized.filter((entry) => entry.primary),
    ...normalized.filter((entry) => !entry.primary),
  ];
}

export function primaryPhoneNumber(entries: PhoneEntry[]): string | null {
  const normalized = normalizePhones(entries);
  return normalized[0]?.number ?? null;
}

export function phonesForEditor(value: unknown, legacyPhone?: string | null): PhoneEntry[] {
  const parsed = parsePhones(value, legacyPhone);
  if (parsed.length > 0) {
    return parsed;
  }
  return [emptyPhoneEntry({ primary: true })];
}

export function validatePhones(
  entries: PhoneEntry[],
  options?: { required?: boolean },
): string | null {
  const normalized = normalizePhones(entries);
  if (normalized.length === 0) {
    return options?.required ? "Phone is required" : null;
  }
  for (const entry of normalized) {
    const message = validatePhone(entry.number, { required: true });
    if (message) {
      return message;
    }
  }
  return null;
}

export function formatPhonesDisplay(entries: PhoneEntry[]): string {
  return normalizePhones(entries)
    .map((entry) => `${entry.number} (${phoneTypeLabel(entry.type)})`)
    .join("\n");
}

/** Single-line phones for History / timeline (e.g. "555-0100 (Work), 555-0199 (Mobile)"). */
export function formatPhonesHistory(entries: PhoneEntry[]): string {
  return normalizePhones(entries)
    .map((entry) => {
      const label = phoneTypeLabel(entry.type);
      return entry.primary ? `${entry.number} (${label}, Primary)` : `${entry.number} (${label})`;
    })
    .join(", ");
}

/** Parse a timeline old/new value that may be JSON phones or already plain text. */
export function coercePhonesHistoryValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return formatPhonesHistory(parsePhones(parsed));
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function phonesToJson(entries: PhoneEntry[]): PhoneEntry[] {
  return normalizePhones(entries).map((entry) => ({
    id: entry.id,
    number: entry.number,
    type: entry.type,
    primary: entry.primary,
  }));
}

/** When only the scalar phone changes, keep phones JSON in sync. */
export function syncPhonesWithScalar(
  existingPhones: unknown,
  nextPhone: string | null | undefined,
): PhoneEntry[] {
  const current = parsePhones(existingPhones, null);
  const next = nextPhone?.trim() || "";
  if (!next) {
    return [];
  }
  if (current.length === 0) {
    return [{ id: createPhoneId(), number: next, type: "work", primary: true }];
  }
  const primaryIndex = current.findIndex((entry) => entry.primary);
  const index = primaryIndex >= 0 ? primaryIndex : 0;
  return normalizePhones(
    current.map((entry, i) => (i === index ? { ...entry, number: next, primary: true } : entry)),
  );
}
