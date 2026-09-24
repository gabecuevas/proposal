"use client";

import { useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  deliveryStatus?: string;
};

type MemberRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export default function SettingsTeamPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const [invitesRes, membersRes] = await Promise.all([
      fetch("/api/workspace/invites", { credentials: "same-origin" }),
      fetch("/api/workspace/members", { credentials: "same-origin" }),
    ]);
    if (invitesRes.ok) {
      const payload = (await invitesRes.json()) as { invites?: InviteRow[] };
      setInvites(payload.invites ?? []);
    }
    if (membersRes.ok) {
      const payload = (await membersRes.json()) as {
        members?: Array<{ id: string; email?: string; name?: string; role: string }>;
      };
      setMembers(
        (payload.members ?? []).map((m) => ({
          id: m.id,
          email: m.email ?? "",
          name: m.name ?? "",
          role: m.role,
        })),
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendInvite() {
    setError("");
    const response = await fetch("/api/workspace/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ invites: [{ email, role }] }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Unable to send invite");
      return;
    }
    setEmail("");
    await load();
  }

  async function resend(inviteId: string) {
    setBusyId(inviteId);
    setError("");
    const response = await fetch(`/api/workspace/invites/${inviteId}/resend`, {
      method: "POST",
      credentials: "same-origin",
    });
    setBusyId(null);
    if (!response.ok) {
      setError("Unable to resend invitation");
      return;
    }
    await load();
  }

  async function revoke(inviteId: string) {
    setBusyId(inviteId);
    setError("");
    const response = await fetch(`/api/workspace/invites/${inviteId}/revoke`, {
      method: "POST",
      credentials: "same-origin",
    });
    setBusyId(null);
    if (!response.ok) {
      setError("Unable to revoke invitation");
      return;
    }
    await load();
  }

  return (
    <SheetPage
      toolbar={
        <>
          <h1 className="text-sm font-semibold text-foreground">Team</h1>
          <p className="ml-auto text-sm text-muted">
            {members.length} members · {invites.length} pending
          </p>
        </>
      }
    >
      <div className="px-4 py-4">
        <p className="text-sm text-muted">Invite teammates and manage pending invitations.</p>
        <div className="mt-6 flex max-w-xl flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-none border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            className="rounded-none border border-border bg-surface px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as "ADMIN" | "MEMBER")}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="button"
            onClick={() => void sendInvite()}
            className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Send invite
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <h2 className="mt-8 text-sm font-semibold">Members</h2>
        <SheetTable>
          <thead>
            <tr>
              <th className={sheetTh()}>Name</th>
              <th className={sheetTh()}>Email</th>
              <th className={sheetTh()}>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className={sheetTr()}>
                <td className={sheetTd()}>{member.name || "—"}</td>
                <td className={sheetTd()}>{member.email}</td>
                <td className={sheetTd()}>{member.role}</td>
              </tr>
            ))}
          </tbody>
        </SheetTable>

        <h2 className="mt-8 text-sm font-semibold">Pending invitations</h2>
        <SheetTable>
          <thead>
            <tr>
              <th className={sheetTh()}>Email</th>
              <th className={sheetTh()}>Role</th>
              <th className={sheetTh()}>Expires</th>
              <th className={sheetTh()}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr className={sheetTr()}>
                <td className={sheetTd()} colSpan={4}>
                  No pending invitations
                </td>
              </tr>
            ) : (
              invites.map((invite) => (
                <tr key={invite.id} className={sheetTr()}>
                  <td className={sheetTd()}>{invite.email}</td>
                  <td className={sheetTd()}>{invite.role}</td>
                  <td className={sheetTd()}>{new Date(invite.expiresAt).toLocaleDateString()}</td>
                  <td className={sheetTd()}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === invite.id}
                        onClick={() => void resend(invite.id)}
                        className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        disabled={busyId === invite.id}
                        onClick={() => void revoke(invite.id)}
                        className="text-sm text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </SheetTable>
      </div>
    </SheetPage>
  );
}
