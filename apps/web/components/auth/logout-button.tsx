"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onLogout}
      className="rounded border border-border px-3 py-1 text-xs text-muted hover:bg-background"
    >
      Log out
    </button>
  );
}
