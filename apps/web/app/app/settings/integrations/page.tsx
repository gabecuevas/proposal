import Link from "next/link";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

const integrations = [
  {
    name: "Webhooks",
    description: "Send document events to your own endpoints.",
    href: "/app/settings#webhooks",
    status: "Connected",
  },
  {
    name: "Developer API",
    description: "Create keys for automations and custom integrations.",
    href: "/app/settings#api-keys",
    status: "Available",
  },
  {
    name: "Stripe",
    description: "Collect payments from signed documents.",
    href: "/app/settings/billing",
    status: "Coming soon",
  },
];

export default function IntegrationsPage() {
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
          {integrations.map((item) => (
            <tr key={item.name} className={sheetTr()}>
              <td className={sheetTd()}>
                <Link href={item.href} className="font-medium text-primary hover:underline">
                  {item.name}
                </Link>
              </td>
              <td className={sheetTd()}>{item.description}</td>
              <td className={sheetTd()}>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
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
