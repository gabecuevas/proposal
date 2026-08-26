"use client";

import { useEffect, useState } from "react";

type ContentBlockItem = {
  id: string;
  name: string;
  block_type: string;
  version: number;
};

export default function ContentLibraryPage() {
  const [items, setItems] = useState<ContentBlockItem[]>([]);
  const [name, setName] = useState("Executive Summary");
  const [blockType, setBlockType] = useState("clause");

  async function load() {
    const response = await fetch("/api/content-blocks");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { blocks: ContentBlockItem[] };
    setItems(payload.blocks);
  }

  async function create() {
    const response = await fetch("/api/content-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, block_type: blockType }),
    });
    if (response.ok) {
      await load();
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="w-full min-w-0 space-y-4">
      <h1 className="text-2xl font-semibold">Content Library</h1>
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm text-muted">Create reusable block</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_auto]">
          <input
            className="min-w-0 rounded border border-border bg-background px-2 py-1 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Block name"
          />
          <input
            className="min-w-0 rounded border border-border bg-background px-2 py-1 text-sm"
            value={blockType}
            onChange={(event) => setBlockType(event.target.value)}
            placeholder="Block type"
          />
          <button
            onClick={create}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground sm:justify-self-start"
          >
            Create
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Version</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                <td className="min-w-0 px-4 py-3 font-medium text-foreground">
                  <span className="truncate">{item.name}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{item.block_type}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">v{item.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No content blocks yet.</p>
        ) : null}
      </div>
    </div>
  );
}
