"use client";

import { useCallback, useEffect, useState } from "react";

type Conversation = {
  id: string;
  subject: string;
  customerUnreadCount: number;
  lastPublicPreview: string | null;
};

type Message = {
  id: string;
  bodyText: string;
  sequence: number;
  senderUserId: string | null;
};

type Props = {
  onClose: () => void;
  onUnreadChange: (count: number) => void;
};

export function MessengerPanel({ onClose, onUnreadChange }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newSubject, setNewSubject] = useState("Support");
  const [mode, setMode] = useState<"list" | "new">("list");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/support/conversations");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { conversations: Conversation[]; unreadTotal: number };
    setConversations(data.conversations);
    onUnreadChange(data.unreadTotal);
  }, [onUnreadChange]);

  const loadMessages = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/support/conversations/${id}/messages`);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);
      const maxSeq = data.messages.reduce((m, row) => Math.max(m, row.sequence), 0);
      if (maxSeq > 0) {
        await fetch(`/api/support/conversations/${id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markReadSequence: maxSeq }),
        });
      }
      void loadList();
    },
    [loadList],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  async function startConversation() {
    if (!draft.trim()) {
      return;
    }
    const res = await fetch("/api/support/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: newSubject,
        message: draft.trim(),
        clientOpId: crypto.randomUUID(),
      }),
    });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setDraft("");
    setMode("list");
    setSelectedId(data.conversation.id);
    void loadList();
  }

  async function sendReply() {
    if (!selectedId || !draft.trim()) {
      return;
    }
    await fetch(`/api/support/conversations/${selectedId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: draft.trim(), clientOpId: crypto.randomUUID() }),
    });
    setDraft("");
    void loadMessages(selectedId);
  }

  return (
    <div className="pointer-events-auto flex h-[420px] w-[360px] flex-col rounded-none border border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">SendDox Support</p>
        <div className="flex gap-2">
          <button type="button" className="text-xs text-primary" onClick={() => setMode(mode === "new" ? "list" : "new")}>
            {mode === "new" ? "Back" : "New"}
          </button>
          <button type="button" className="text-xs text-muted" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {mode === "new" ? (
        <div className="flex flex-1 flex-col gap-2 p-3">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="rounded-none border border-border px-2 py-1 text-sm"
            placeholder="Subject"
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="flex-1 rounded-none border border-border px-2 py-1 text-sm"
            placeholder="How can we help?"
          />
          <button
            type="button"
            onClick={() => void startConversation()}
            className="rounded-none bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Start conversation
          </button>
        </div>
      ) : selectedId ? (
        <>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {messages.map((m) => (
              <div key={m.id} className="rounded-none border border-border px-2 py-1.5 text-sm">
                {m.bodyText}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 rounded-none border border-border px-2 py-1 text-sm"
              placeholder="Reply…"
            />
            <button
              type="button"
              onClick={() => void sendReply()}
              className="rounded-none bg-primary px-3 py-1 text-sm text-primary-foreground"
            >
              Send
            </button>
          </div>
        </>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto p-2 text-sm">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="mb-1 w-full rounded-none border border-border px-2 py-2 text-left hover:bg-slate-50"
              >
                <p className="font-medium">{c.subject}</p>
                <p className="truncate text-xs text-muted">{c.lastPublicPreview}</p>
              </button>
            </li>
          ))}
          {conversations.length === 0 ? (
            <p className="p-2 text-muted">No conversations yet.</p>
          ) : null}
        </ul>
      )}
    </div>
  );
}
