"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { useLogout } from "@/components/auth/logout-button";
import { IconMore, IconSettings, IconSignOut } from "./shell-icons";

type SettingsMenuProps = {
  userName: string;
  userEmail: string;
  userInitials: string;
  active: boolean;
};

const menuGroups = [
  [
    { label: "Workspace settings", href: "/app/settings" },
    { label: "Integrations", href: "/app/settings/integrations" },
  ],
  [
    { label: "All users", href: "/app/settings/users" },
    { label: "Calendar Sync", href: "/app/settings/integrations/calendar" },
    { label: "Billing", href: "/app/settings/billing" },
  ],
];

export function SettingsMenu({ userName, userEmail, userInitials, active }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const menuId = useId();
  const logout = useLogout();

  useEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setMenuPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
    }
    place();
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const highlighted = open || active;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
          highlighted
            ? "bg-slate-100 font-medium text-foreground"
            : "text-muted hover:bg-slate-100/80 hover:text-foreground",
        )}
      >
        <IconSettings className="shrink-0 opacity-80" />
        <span className="min-w-0 flex-1 truncate text-left">Settings</span>
        <IconMore className="shrink-0 opacity-70" />
      </button>

      {open && menuPos ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Settings"
          style={{ bottom: menuPos.bottom, left: menuPos.left }}
          className="fixed z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{userName}</p>
              <p className="truncate text-xs text-muted" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>
          {menuGroups.map((group) => (
            <div key={group[0]!.href} className="border-t border-border py-1">
              {group.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-foreground transition-colors hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="border-t border-border py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-foreground transition-colors hover:bg-slate-50"
            >
              Sign out
              <IconSignOut className="shrink-0 text-muted" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
