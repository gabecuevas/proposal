"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  role: string;
  name: string;
  email: string;
  joinedAt: string;
};

export default function UsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/workspace/members");
      if (!response.ok) {
        setError("Failed to load users");
        return;
      }
      const payload = (await response.json()) as { members?: Member[] };
      if (!cancelled) {
        setMembers(payload.members ?? []);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">All users</h1>
        <p className="mt-2 text-sm text-muted">People with access to this workspace.</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
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
                <td className="px-4 py-3 font-medium text-foreground">{member.name || "—"}</td>
                <td className="px-4 py-3 text-muted">{member.email}</td>
                <td className="px-4 py-3 text-muted">{member.role}</td>
                <td className="px-4 py-3 text-muted">{new Date(member.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && !error ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No users found.</p>
        ) : null}
      </div>
    </div>
  );
}
