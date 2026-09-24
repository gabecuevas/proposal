"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SheetPage } from "@/components/ui/sheet-table";

type Conversation = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  lastPublicPreview: string | null;
  adminUnreadCount: number;
  customer?: { name: string; email: string };
};

type Message = {
  id: string;
  bodyText: string;
  visibility: string;
  sequence: number;
  senderUserId: string | null;
  createdAt: string;
};

export default function AdminInboxPage() {
  const [status, setStatus] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [detail, setDetail] = useState<Conversation | null>(null);
  const [composer, setComposer] = useState("");
  const [internalMode, setInternalMode] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: "50" });
    if (status) {
      params.set("status", status);
    }
    const res = await fetch(`/api/admin/inbox/conversations?${params}`);
    if (!res.ok) {
      setError("Unable to load inbox");
      return;
    }
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
    if (!selectedId && data.conversations[0]) {
      setSelectedId(data.conversations[0].id);
    }
  }, [selectedId, status]);

  const loadThread = useCallback(async (id: string) => {
    const [convRes, msgRes] = await Promise.all([
      fetch(`/api/admin/inbox/conversations/${id}`),
      fetch(`/api/admin/inbox/conversations/${id}/messages`),
    ]);
    if (!convRes.ok || !msgRes.ok) {
      setError("Unable to load conversation");
      return;
    }
    const convData = (await convRes.json()) as { conversation: Conversation };
    const msgData = (await msgRes.json()) as { messages: Message[] };
    setDetail(convData.conversation);
    setMessages(msgData.messages);
    const maxSeq = msgData.messages.reduce((m, row) => Math.max(m, row.sequence), 0);
    if (maxSeq > 0) {
      await fetch(`/api/admin/inbox/conversations/${id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markReadSequence: maxSeq }),
      });
    }
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadThread(selectedId);
    }
  }, [selectedId, loadThread]);

  async function sendReply() {
    if (!selectedId || !composer.trim()) {
      return;
    }
    const clientOpId = crypto.randomUUID();
    const res = await fetch(`/api/admin/inbox/conversations/${selectedId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: composer.trim(),
        visibility: internalMode ? "INTERNAL" : "PUBLIC",
        clientOpId,
      }),
    });
    if (!res.ok) {
      setError("Send failed");
      return;
    }
    setComposer("");
    void loadThread(selectedId);
  }

  async function setConvStatus(action: "resolve" | "reopen") {
    if (!selectedId) {
      return;
    }
    await fetch(`/api/admin/inbox/conversations/${selectedId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    void loadThread(selectedId);
  }

  return (
    <SheetPage error={error}>
      <div className="flex h-[calc(100vh-56px)] min-h-0">
        <aside className="flex w-52 shrink-0 flex-col border-r border-border p-3 text-sm">
          <p className="mb-2 font-medium">Filters</p>
          {["", "OPEN", "WAITING_ON_CUSTOMER", "RESOLVED"].map((value) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setStatus(value)}
              className={`mb-1 rounded-none border px-2 py-1 text-left ${
                status === value ? "border-primary bg-slate-50" : "border-border"
              }`}
            >
              {value || "All"}
            </button>
          ))}
        </aside>
        <section className="flex w-72 shrink-0 flex-col border-r border-border">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Conversations</div>
          <ul className="min-h-0 flex-1 overflow-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-none border-b border-border px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    selectedId === c.id ? "bg-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{c.subject}</span>
                    {c.adminUnreadCount > 0 ? (
                      <span className="rounded-none bg-primary px-1.5 text-xs text-primary-foreground">
                        {c.adminUnreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">{c.customer?.email}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-2">
            <h1 className="text-sm font-semibold">{selected?.subject ?? "Select a conversation"}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void setConvStatus("resolve")}
                className="rounded-none border border-border px-2 py-1 text-xs"
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => void setConvStatus("reopen")}
                className="rounded-none border border-border px-2 py-1 text-xs"
              >
                Reopen
              </button>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={internalMode}
                  onChange={(e) => setInternalMode(e.target.checked)}
                />
                Internal note
              </label>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-xl rounded-none border px-3 py-2 text-sm ${
                  m.visibility === "INTERNAL" ? "border-amber-300 bg-amber-50" : "border-border"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.bodyText}</p>
                <p className="mt-1 text-xs text-muted">#{m.sequence}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={2}
              className="min-h-[56px] flex-1 rounded-none border border-border px-2 py-1.5 text-sm"
              placeholder="Write a reply…"
            />
            <button
              type="button"
              onClick={() => void sendReply()}
              className="rounded-none bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Send
            </button>
          </div>
        </section>
        <aside className="hidden w-64 shrink-0 border-l border-border p-4 text-sm xl:block">
          <p className="font-medium">Details</p>
          {detail?.customer ? (
            <div className="mt-2 space-y-1 text-muted">
              <p>{detail.customer.name}</p>
              <p>{detail.customer.email}</p>
              <p>Status: {detail.status}</p>
              <p>Priority: {detail.priority}</p>
            </div>
          ) : (
            <p className="mt-2 text-muted">No conversation selected</p>
          )}
        </aside>
      </div>
    </SheetPage>
  );
}
