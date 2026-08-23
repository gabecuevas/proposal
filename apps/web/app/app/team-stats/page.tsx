"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  role: string;
  joinedAt: string;
  name: string;
  email: string;
};

export default function TeamStatsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/workspace/members");
      if (!response.ok) {
        setError("Failed to load team members.");
        return;
      }
      const payload = (await response.json()) as { members: Member[] };
      if (!cancelled) {
        setMembers(payload.members);
      }
    }
    void load().catch(() => setError("Failed to load team members."));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="border-b border-border bg-slate-50/80 px-4 py-2 text-center text-sm font-medium text-foreground">
          Team Members ({members.length})
        </header>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                <td className="px-4 py-3 text-muted">{member.email}</td>
                <td className="px-4 py-3 text-muted">{member.role}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No team members yet.</p>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        Per-member proposal totals need an owner on each document, which the current schema does
        not record.
      </p>
    </div>
  );
}
