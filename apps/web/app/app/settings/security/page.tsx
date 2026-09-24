"use client";

import Link from "next/link";
import { SheetPadded } from "@/components/ui/sheet-table";

export default function SettingsSecurityPage() {
  return (
    <SheetPadded>
      <h1 className="text-sm font-semibold text-foreground">Security</h1>
      <p className="mt-2 text-sm text-muted">Manage password and session security for your account.</p>
      <Link
        href="/forgot-password"
        className="mt-6 inline-flex rounded-none border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        Reset password
      </Link>
    </SheetPadded>
  );
}
