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
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Content Library</h1>
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm text-muted">Create reusable block</p>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded border border-border bg-background px-2 py-1 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Block name"
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 text-sm"
            value={blockType}
            onChange={(event) => setBlockType(event.target.value)}
            placeholder="Block type"
          />
          <button onClick={create} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground">
            Create
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-border bg-surface p-3 text-sm">
            <p className="font-medium">
              {item.name} (v{item.version})
            </p>
            <p className="text-xs text-muted">{item.block_type}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
