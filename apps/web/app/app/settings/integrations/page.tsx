"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
import type { CrmCalendarAccountDto } from "@/lib/crm/calendar-accounts";
import type { CrmEmailAccountDto } from "@/lib/crm/emails";

type IntegrationStatus = "Connected" | "Available" | "Coming soon";

type IntegrationRow = {
  name: string;
  description: string;
  href: string;
  status: IntegrationStatus;
  dynamic?: "email" | "calendar";
};

const BASE_INTEGRATIONS: IntegrationRow[] = [
  {
    name: "Webhooks",
    description: "Send document events to your own endpoints.",
    href: "/app/settings#webhooks",
    status: "Available",
  },
  {
    name: "Developer API",
    description: "Create keys for automations and custom integrations.",
    href: "/app/settings#api-keys",
    status: "Available",
  },
  {
    name: "Calendar Sync",
    description: "Sync Google Calendar events alongside CRM activities for each user.",
    href: "/app/settings/integrations/calendar",
    status: "Available",
    dynamic: "calendar",
  },
  {
    name: "Email Sync",
    description: "Connect Gmail so inbox, sent, and drafts stay in sync for this workspace.",
    href: "/app/settings/integrations/email",
    status: "Available",
    dynamic: "email",
  },
  {
    name: "Stripe",
    description: "Collect payments from signed documents.",
    href: "/app/settings/billing",
    status: "Coming soon",
  },
];

function isConnectedSyncStatus(status: string | undefined): boolean {
  return status === "ACTIVE" || status === "ERROR";
}

function statusBadgeClass(status: IntegrationStatus): string {
  switch (status) {
    case "Connected":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Available":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Coming soon":
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
}

export default function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>(BASE_INTEGRATIONS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [emailRes, calendarRes] = await Promise.all([
        fetch("/api/crm/email-accounts"),
        fetch("/api/crm/calendar-accounts"),
      ]);

      let emailConnected = false;
      let calendarConnected = false;

      if (emailRes.ok) {
        const payload = (await emailRes.json().catch(() => ({}))) as {
          accounts?: CrmEmailAccountDto[];
        };
        emailConnected = (payload.accounts ?? []).some((account) =>
          isConnectedSyncStatus(account.syncStatus),
        );
      }

      if (calendarRes.ok) {
        const payload = (await calendarRes.json().catch(() => ({}))) as {
          accounts?: CrmCalendarAccountDto[];
        };
        calendarConnected = (payload.accounts ?? []).some((account) =>
          isConnectedSyncStatus(account.syncStatus),
        );
      }

      if (cancelled) {
        return;
      }

      setRows(
        BASE_INTEGRATIONS.map((item) => {
          if (item.dynamic === "email") {
            return { ...item, status: emailConnected ? "Connected" : "Available" };
          }
          if (item.dynamic === "calendar") {
            return { ...item, status: calendarConnected ? "Connected" : "Available" };
          }
          return item;
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SheetPage
      toolbar={
        <>
          <h1 className="text-sm font-semibold text-foreground">Integrations</h1>
          <p className="text-sm text-muted">Connect the tools you use to send, sign, and get paid.</p>
        </>
      }
    >
      <SheetTable>
        <thead>
          <tr>
            <th className={sheetTh()}>Integration</th>
            <th className={sheetTh()}>Description</th>
            <th className={sheetTh()}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.name} className={sheetTr()}>
              <td className={sheetTd()}>
                <Link href={item.href} className="font-medium text-primary hover:underline">
                  {item.name}
                </Link>
              </td>
              <td className={sheetTd()}>{item.description}</td>
              <td className={sheetTd()}>
                <span
                  className={cn(
                    "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                    statusBadgeClass(item.status),
                  )}
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </SheetTable>
    </SheetPage>
  );
}
