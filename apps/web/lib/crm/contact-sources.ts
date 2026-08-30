/**
 * Default People source options. Workspace admins will manage this list in
 * Settings later, similar to Pipedrive custom field options.
 */
export const DEFAULT_CONTACT_SOURCES = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "cold_call", label: "Cold call" },
  { value: "event", label: "Event" },
  { value: "partner", label: "Partner" },
  { value: "advertisement", label: "Advertisement" },
  { value: "social", label: "Social media" },
  { value: "other", label: "Other" },
] as const;

export function contactSourceOptions(
  current?: string | null,
): Array<{ value: string; label: string }> {
  const options = DEFAULT_CONTACT_SOURCES.map((item) => ({
    value: item.value,
    label: item.label,
  }));
  const value = current?.trim();
  if (value && !options.some((item) => item.value === value)) {
    options.push({ value, label: value });
  }
  return options;
}

export function contactSourceLabel(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return DEFAULT_CONTACT_SOURCES.find((item) => item.value === value)?.label ?? value;
}
