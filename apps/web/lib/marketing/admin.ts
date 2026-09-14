/** Emails allowed to manage the public SEO template library (upload/edit placeholders). */
const MARKETING_LIBRARY_ADMIN_EMAILS = new Set(["gabe@cuevas.com"]);

export function isMarketingLibraryAdmin(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return MARKETING_LIBRARY_ADMIN_EMAILS.has(email.trim().toLowerCase());
}
