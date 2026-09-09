import { CLIENT_VARIABLES, COMPANY_VARIABLES, type CrmVariableKey } from "@/lib/crm/variables";

const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/15 focus:ring-2";

export function crmInputClass(): string {
  return inputClass;
}

export function VariablePills({ keys }: { keys: CrmVariableKey[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((item) => (
        <code
          key={item.key}
          title={item.label}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900"
        >
          [{item.key}]
        </code>
      ))}
    </div>
  );
}

export function ClientVariableHint() {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Document variables</p>
      <VariablePills keys={CLIENT_VARIABLES} />
    </div>
  );
}

export function CompanyVariableHint() {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Document variables</p>
      <VariablePills keys={COMPANY_VARIABLES} />
    </div>
  );
}
