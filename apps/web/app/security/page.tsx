export default function SecurityPage() {
  const controls = [
    "Workspace tenancy isolation and role-based access controls (Owner/Admin/Member)",
    "Immutable activity events, audit exports, checksum verification, and signed evidence bundles",
    "Webhook trust policy with IP allowlisting and mTLS enforcement",
    "Rate limiting on auth, signing, API-key, and audit endpoints",
    "Request ID propagation and health/readiness observability endpoints",
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Security</p>
      <h1 className="mt-3 text-4xl font-semibold">Enterprise controls from day one</h1>
      <p className="mt-4 text-muted">
        DoxySign is designed with operational controls for document governance, secure API usage,
        and verifiable auditability.
      </p>
      <ul className="mt-8 space-y-3">
        {controls.map((control) => (
          <li key={control} className="glass-card rounded-lg p-4 text-sm text-muted">
            {control}
          </li>
        ))}
      </ul>
    </main>
  );
}
