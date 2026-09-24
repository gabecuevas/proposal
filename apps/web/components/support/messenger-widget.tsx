"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";

const MessengerPanel = lazy(() =>
  import("./messenger-panel").then((mod) => ({ default: mod.MessengerPanel })),
);

type MessengerWidgetProps = {
  enabled: boolean;
};

export function MessengerWidget({ enabled }: MessengerWidgetProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshBadge = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const res = await fetch("/api/support/conversations");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { unreadTotal?: number };
      setUnread(data.unreadTotal ?? 0);
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refreshBadge();
    const interval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void refreshBadge();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [enabled, refreshBadge]);

  useEffect(() => {
    if (!enabled || !open) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void refreshBadge();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [enabled, open, refreshBadge]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open ? (
        <Suspense fallback={<div className="pointer-events-auto h-96 w-80 rounded-none border bg-surface p-4 text-sm">Loading…</div>}>
          <MessengerPanel
            onClose={() => setOpen(false)}
            onUnreadChange={setUnread}
          />
        </Suspense>
      ) : null}
      <button
        type="button"
        aria-label="Open support messenger"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto relative rounded-none bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-md"
      >
        Support
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-none bg-red-600 px-1.5 text-xs text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
