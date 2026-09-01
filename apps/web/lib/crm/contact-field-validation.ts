const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function validatePersonName(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }
  if (trimmed.length > 80) {
    return `${label} must be 80 characters or fewer`;
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return `Enter a valid ${label.toLowerCase()}`;
  }
  return null;
}

export function validateEmail(value: string, options?: { required?: boolean }): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return options?.required === false ? null : "Email is required";
  }
  if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address";
  }
  return null;
}

export function validatePhone(value: string, options?: { required?: boolean }): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return options?.required ? "Phone is required" : null;
  }
  if (!/^[+]?[\d\s().-]+$/.test(trimmed)) {
    return "Enter a valid phone number";
  }
  const digits = digitsOnly(trimmed);
  if (digits.length < 7 || digits.length > 15) {
    return "Enter a valid phone number";
  }
  return null;
}

export function validateTitle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 120) {
    return "Title must be 120 characters or fewer";
  }
  return null;
}

export function validateWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Enter a valid website";
    }
    if (!url.hostname.includes(".")) {
      return "Enter a valid website";
    }
    return null;
  } catch {
    return "Enter a valid website";
  }
}

function optionalString(value: string | null | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ?? "";
}

export function leadContactDetailsError(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_title?: string | null;
  website?: string | null;
}): string | null {
  const firstName = optionalString(input.first_name);
  const lastName = optionalString(input.last_name);
  const email = optionalString(input.email);
  const phone = optionalString(input.phone);
  const title = optionalString(input.contact_title);
  const website = optionalString(input.website);
  return (
    validatePersonName(firstName, "First name") ??
    validatePersonName(lastName, "Last name") ??
    validateEmail(email) ??
    validatePhone(phone, { required: true }) ??
    (title !== undefined ? validateTitle(title) : null) ??
    (website !== undefined ? validateWebsite(website) : null)
  );
}

export function firstContactDetailsError(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  website?: string | null;
}): string | null {
  const firstName = optionalString(input.first_name);
  const lastName = optionalString(input.last_name);
  const email = optionalString(input.email);
  const phone = optionalString(input.phone);
  const title = optionalString(input.title);
  const website = optionalString(input.website);
  return (
    (firstName !== undefined ? validatePersonName(firstName, "First name") : null) ??
    (lastName !== undefined ? validatePersonName(lastName, "Last name") : null) ??
    (email !== undefined ? validateEmail(email) : null) ??
    (phone !== undefined ? validatePhone(phone) : null) ??
    (title !== undefined ? validateTitle(title) : null) ??
    (website !== undefined ? validateWebsite(website) : null)
  );
}
