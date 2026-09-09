"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useLogout() {
  const router = useRouter();

  return useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);
}

export function LogoutButton() {
  const logout = useLogout();

  return (
    <button
      onClick={() => void logout()}
      type="button"
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-primary/30 hover:text-foreground"
    >
      Log out
    </button>
  );
}
