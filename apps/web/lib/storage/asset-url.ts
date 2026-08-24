export const UPLOAD_KEY_PREFIX = "uploads";

export function workspaceUploadPrefix(workspaceId: string): string {
  return `workspaces/${workspaceId}/${UPLOAD_KEY_PREFIX}/`;
}

export function keyBelongsToWorkspace(key: string, workspaceId: string): boolean {
  return key.startsWith(workspaceUploadPrefix(workspaceId));
}

/**
 * Same-origin path works for the browser, which carries the session cookie.
 * The PDF worker renders detached from any origin, so it needs an absolute URL
 * plus a token.
 */
export function assetUrl(key: string, options?: { baseUrl?: string; token?: string }): string {
  const path = `/api/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
  const base = options?.baseUrl?.replace(/\/$/, "") ?? "";
  const query = options?.token ? `?token=${encodeURIComponent(options.token)}` : "";
  return `${base}${path}${query}`;
}
