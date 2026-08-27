import Link from "next/link";

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
    <div className="w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-2 text-sm text-muted">Connect the tools you use to send, sign, and get paid.</p>
      </div>
      <div className="space-y-3">
        {integrations.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-slate-50/80"
          >
            <div>
              <p className="font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </div>
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {item.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
