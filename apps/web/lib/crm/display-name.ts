export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const formatted = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return formatted || email;
}

export function userDisplayName(user: { name: string; email: string } | null | undefined): string {
  if (!user) {
    return "Unknown user";
  }
  if (user.name.trim()) {
    return user.name.trim();
  }
  return displayNameFromEmail(user.email);
}
