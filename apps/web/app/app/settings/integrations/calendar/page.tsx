import Link from "next/link";
import { SheetPage } from "@/components/ui/sheet-table";

export default function CalendarSyncSettingsPage() {
  return (
    <SheetPage
      toolbar={
        <>
          <h1 className="text-sm font-semibold text-foreground">Calendar Sync</h1>
          <p className="text-sm text-muted">
            Connect Google Calendar so activities stay in sync for users in this workspace.
          </p>
        </>
      }
    >
      <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
            Sync inactive
          </span>
        </div>
        <p className="text-sm text-foreground">
          Google Calendar sync is not connected yet. When you connect it, open and completed activities can appear
          on each user&apos;s Google Calendar, similar to Pipedrive.
        </p>
        <p className="text-sm text-muted">
          The connection workflow will live here. You can also open{" "}
          <Link href="/app/contacts/calendar" className="font-medium text-primary hover:underline">
            Contacts → Calendar
          </Link>{" "}
          to review activities while sync setup is pending.
        </p>
        <button
          type="button"
          disabled
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-60"
        >
          Connect Google Calendar
        </button>
        <p className="text-xs text-muted">Connection steps will be enabled in the next update.</p>
      </div>
    </SheetPage>
  );
}
