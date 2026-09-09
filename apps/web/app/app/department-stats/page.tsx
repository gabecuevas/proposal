export default function DepartmentStatsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface px-6 py-20 text-center">
      <div className="mb-5 rounded-2xl bg-sky-50 p-5 text-sky-600" aria-hidden>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M4 20V9l6-4 6 4v11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 20V12h4v8M3 20h18M9 12h2M9 16h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-medium text-foreground">No departments configured</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Departments are not part of the workspace model yet, so there is nothing to break proposal
        performance down by. Once documents can be assigned to a department, their totals will
        appear here.
      </p>
    </section>
  );
}
