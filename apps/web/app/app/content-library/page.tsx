"use client";

import { useEffect, useState } from "react";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";

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
    <SheetPage
      toolbar={
        <>
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Block name"
          />
          <input
            className="h-10 w-40 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
            value={blockType}
            onChange={(event) => setBlockType(event.target.value)}
            placeholder="Block type"
          />
          <p className="text-sm text-muted">
            {items.length} {items.length === 1 ? "block" : "blocks"}
          </p>
          <button
            type="button"
            onClick={() => void create()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
          >
            + Add block
          </button>
        </>
      }
    >
      <SheetTable
        minWidth="28rem"
        empty={
          items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No content blocks yet.</p>
          ) : null
        }
      >
        <thead>
          <tr>
            <th className={sheetTh()}>Name</th>
            <th className={sheetTh()}>Type</th>
            <th className={sheetTh()}>Version</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={sheetTr()}>
              <td className={sheetTd("font-medium text-foreground")}>{item.name}</td>
              <td className={sheetTd()}>{item.block_type}</td>
              <td className={sheetTd()}>v{item.version}</td>
            </tr>
          ))}
        </tbody>
      </SheetTable>
    </SheetPage>
  );
}
