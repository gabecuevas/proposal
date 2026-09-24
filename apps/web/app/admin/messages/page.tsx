"use client";

import { useCallback, useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

type Campaign = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  audienceSummary?: string;
  deliveryMode?: string;
  delivered?: number;
  viewed?: number;
  clicked?: number;
  replied?: number;
};

const tabs = ["", "DRAFT", "SCHEDULED", "LIVE", "PAUSED", "COMPLETED"] as const;

export default function AdminMessagesPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const params = tab ? `?status=${tab}` : "";
    const res = await fetch(`/api/admin/messages/campaigns${params}`);
    if (!res.ok) {
      setError(res.status === 404 ? "Campaigns are disabled" : "Unable to load campaigns");
      return;
    }
    const data = (await res.json()) as { campaigns: Campaign[] };
    setCampaigns(data.campaigns);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCampaign() {
    const res = await fetch("/api/admin/messages/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, bodyText }),
    });
    if (!res.ok) {
      setError("Create failed");
      return;
    }
    setTitle("");
    setBodyText("");
    setShowEditor(false);
    void load();
  }

  async function publish(id: string) {
    await fetch(`/api/admin/messages/campaigns/${id}/publish`, { method: "POST" });
    void load();
  }

  async function pause(id: string) {
    await fetch(`/api/admin/messages/campaigns/${id}/pause`, { method: "POST" });
    void load();
  }

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
          {tabs.map((value) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-none border px-3 py-1.5 text-sm ${
                tab === value ? "border-primary bg-slate-50" : "border-border"
              }`}
            >
              {value || "All"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEditor((v) => !v)}
            className="ml-auto rounded-none bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            New campaign
          </button>
        </>
      }
    >
      {showEditor ? (
        <div className="space-y-2 border-b border-border p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full max-w-lg rounded-none border border-border px-2 py-1.5 text-sm"
          />
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Message body"
            rows={4}
            className="w-full max-w-2xl rounded-none border border-border px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void createCampaign()}
            className="rounded-none bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Save draft
          </button>
        </div>
      ) : null}
      <SheetTable empty={campaigns.length === 0 ? <p className="p-4 text-sm text-muted">No campaigns</p> : undefined}>
        <thead>
          <tr className={sheetTr()}>
            <th className={sheetTh()}>Title</th>
            <th className={sheetTh()}>Status</th>
            <th className={sheetTh()}>Audience</th>
            <th className={sheetTh()}>Mode</th>
            <th className={sheetTh()}>Delivered</th>
            <th className={sheetTh()}>Viewed</th>
            <th className={sheetTh()}>Clicked</th>
            <th className={sheetTh()}>Replied</th>
            <th className={sheetTh()}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className={sheetTr()}>
              <td className={sheetTd()}>{c.title}</td>
              <td className={sheetTd()}>
                <span className="rounded-none border border-border px-1.5 py-0.5 text-xs">{c.status}</span>
              </td>
              <td className={sheetTd()}>{c.audienceSummary ?? "All users"}</td>
              <td className={sheetTd()}>{c.deliveryMode ?? "ongoing"}</td>
              <td className={sheetTd()}>{c.delivered ?? 0}</td>
              <td className={sheetTd()}>
                {c.delivered
                  ? `${c.viewed ?? 0} (${Math.round(((c.viewed ?? 0) / c.delivered) * 100)}%)`
                  : "—"}
              </td>
              <td className={sheetTd()}>
                {c.delivered
                  ? `${c.clicked ?? 0} (${Math.round(((c.clicked ?? 0) / c.delivered) * 100)}%)`
                  : "—"}
              </td>
              <td className={sheetTd()}>
                {c.delivered
                  ? `${c.replied ?? 0} (${Math.round(((c.replied ?? 0) / c.delivered) * 100)}%)`
                  : "—"}
              </td>
              <td className={sheetTd()}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void publish(c.id)}
                    className="rounded-none border border-border px-2 py-0.5 text-xs"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => void pause(c.id)}
                    className="rounded-none border border-border px-2 py-0.5 text-xs"
                  >
                    Pause
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </SheetTable>
    </SheetPage>
  );
}
