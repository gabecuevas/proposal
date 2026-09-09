"use client";

import { useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

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
    <SheetPage
      error={error}
      toolbar={
        <>
          <h1 className="text-sm font-semibold text-foreground">All users</h1>
          <p className="ml-auto text-sm text-muted">
            {members.length} {members.length === 1 ? "user" : "users"}
          </p>
        </>
      }
    >
      <SheetTable
        empty={
          members.length === 0 && !error ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No users found.</p>
          ) : null
        }
      >
        <thead>
          <tr>
            <th className={sheetTh()}>Name</th>
            <th className={sheetTh()}>Email</th>
            <th className={sheetTh()}>Role</th>
            <th className={sheetTh()}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className={sheetTr()}>
              <td className={sheetTd("font-medium text-foreground")}>{member.name || "—"}</td>
              <td className={sheetTd()}>{member.email}</td>
              <td className={sheetTd()}>{member.role}</td>
              <td className={sheetTd()}>{new Date(member.joinedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </SheetTable>
    </SheetPage>
  );
}
