"use client";

import { useEffect } from "react";
import { MessengerWidget } from "./messenger-widget";

type SupportShellProps = {
  messengerEnabled: boolean;
};

export function SupportShell({ messengerEnabled }: SupportShellProps) {
  useEffect(() => {
    const ping = () => {
      if (document.hidden) {
        return;
      }
      void fetch("/api/support/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    };
    ping();
    const interval = window.setInterval(ping, 120_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return <MessengerWidget enabled={messengerEnabled} />;
}
