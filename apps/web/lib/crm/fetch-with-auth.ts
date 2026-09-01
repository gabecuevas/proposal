export function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    redirectToLogin();
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}
