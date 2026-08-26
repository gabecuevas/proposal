"use client";

import type { Editor } from "@tiptap/core";
import { useRef, useState, type ReactElement } from "react";
import {
  insertBulletList,
  insertDivider,
  insertHeading,
  insertImageAsset,
  insertOrderedList,
  insertPageBreak,
  insertQuote,
  insertQuoteTable,
  insertTable,
  insertTableOfContents,
  insertTextBlock,
  insertVariable,
  insertVideo,
  isSupportedImage,
  uploadAsset,
} from "@/lib/editor/insert-elements";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import {
  IconDivider,
  IconImage,
  IconLibrary,
  IconListBullet,
  IconListOrdered,
  IconPageBreak,
  IconQuote,
  IconSignature,
  IconTable,
  IconTextT,
  IconToc,
  IconVideo,
} from "./creator-icons";

type Props = {
  editor: Editor | null;
  onDone: () => void;
  /** Top-level document position. When set, new blocks are inserted as siblings
   *  instead of merging into the current text box. */
  insertPos?: number;
  /** Runs before an element is inserted, so callers can move the cursor first. */
  onBeforeInsert?: () => void;
  /** When set, only matching rows are shown (used by the `/` slash menu). */
  query?: string;
  /** Opens the searchable content library modal (Insert menu). */
  onOpenLibrary?: () => void;
  onInsertField?: (type: SignerFieldEditorType) => void;
  variableKeys?: string[];
};

type Entry = {
  id: string;
  label: string;
  hint: string;
  Icon: (props: { className?: string }) => ReactElement;
  run: (editor: Editor, at?: number) => void;
};

const entries: Entry[] = [
  { id: "text", label: "Text box", hint: "Write anywhere", Icon: IconTextT, run: insertTextBlock },
  {
    id: "heading",
    label: "Heading",
    hint: "Section title",
    Icon: IconTextT,
    run: (editor, at) => insertHeading(editor, 2, at),
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "Unordered",
    Icon: IconListBullet,
    run: insertBulletList,
  },
  {
    id: "ordered",
    label: "Numbered list",
    hint: "Ordered",
    Icon: IconListOrdered,
    run: insertOrderedList,
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Pull quote",
    Icon: IconQuote,
    run: insertQuote,
  },
  { id: "toc", label: "Table of contents", hint: "From headings", Icon: IconToc, run: insertTableOfContents },
  { id: "divider", label: "Divider", hint: "Horizontal rule", Icon: IconDivider, run: insertDivider },
  { id: "pageBreak", label: "Page break", hint: "Start a new page", Icon: IconPageBreak, run: insertPageBreak },
  {
    id: "quoteTable",
    label: "Pricing table",
    hint: "Quote / line items",
    Icon: IconTable,
    run: (editor, at) => insertQuoteTable(editor, "default", at),
  },
];

export function ElementMenu({
  editor,
  onDone,
  insertPos,
  onBeforeInsert,
  query = "",
  onOpenLibrary,
  onInsertField,
  variableKeys = [],
}: Props) {
  const [view, setView] = useState<"root" | "video" | "table">("root");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const [tableSize, setTableSize] = useState({ rows: 3, cols: 3 });
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const needle = query.trim().toLowerCase();
  const visibleEntries = needle
    ? entries.filter(
        (entry) =>
          entry.label.toLowerCase().includes(needle) || entry.hint.toLowerCase().includes(needle),
      )
    : entries;
  const showLibrary =
    Boolean(onOpenLibrary) &&
    (!needle || needle.includes("library") || needle.includes("content") || needle.includes("saved"));
  const showImage = !needle || "image".includes(needle) || needle.includes("image") || needle.includes("photo");
  const showVideo = !needle || needle.includes("video") || needle.includes("youtube");
  const showTable = !needle || needle.includes("table") || needle.includes("grid") || needle.includes("excel");
  const showFields =
    Boolean(onInsertField) &&
    (!needle ||
      needle.includes("sign") ||
      needle.includes("field") ||
      needle.includes("date") ||
      needle.includes("initial"));
  const visibleVariables = needle
    ? variableKeys.filter((key) => key.toLowerCase().includes(needle))
    : variableKeys.slice(0, 8);

  function run(action: (editor: Editor, at?: number) => void) {
    if (!editor) {
      return;
    }
    onBeforeInsert?.();
    action(editor, insertPos);
    onDone();
  }

  async function onPickImage(file: File | undefined) {
    if (!editor || !file) {
      return;
    }
    if (!isSupportedImage(file)) {
      setUploadError("Use a PNG, JPEG or WebP image.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const asset = await uploadAsset(file);
      onBeforeInsert?.();
      insertImageAsset(editor, asset, insertPos);
      onDone();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (view === "video") {
    return (
      <Panel>
        <PanelTitle onBack={() => setView("root")}>Add video</PanelTitle>
        <p className="mb-2 text-xs text-muted">Paste a YouTube link and it plays inline.</p>
        <input
          autoFocus
          value={videoUrl}
          onChange={(event) => {
            setVideoUrl(event.target.value);
            setVideoError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitVideo();
            }
          }}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label="Video URL"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/15 focus:ring-2"
        />
        {videoError ? <p className="mt-1.5 text-xs text-red-600">{videoError}</p> : null}
        <button
          type="button"
          onClick={submitVideo}
          className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          Add video
        </button>
      </Panel>
    );
  }

  if (view === "table") {
    return (
      <Panel>
        <PanelTitle onBack={() => setView("root")}>Insert table</PanelTitle>
        <div className="mb-2 grid grid-cols-6 gap-0.5" role="presentation">
          {Array.from({ length: 36 }, (_, index) => {
            const row = Math.floor(index / 6) + 1;
            const col = (index % 6) + 1;
            const active = row <= tableSize.rows && col <= tableSize.cols;
            return (
              <button
                key={index}
                type="button"
                aria-label={`${row} by ${col} table`}
                onMouseEnter={() => setTableSize({ rows: row, cols: col })}
                onClick={() => run((editor) => insertTable(editor, row, col, insertPos))}
                className={`h-5 rounded-sm border ${
                  active ? "border-primary bg-primary/20" : "border-border bg-background"
                }`}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted">
          {tableSize.rows} × {tableSize.cols} with a header row
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      {showLibrary ? (
        <>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Add from</p>
          <Row
            Icon={IconLibrary}
            label="Content library"
            hint="Search saved elements"
            onClick={() => {
              onOpenLibrary?.();
              onDone();
            }}
          />
        </>
      ) : null}
      {showFields ? (
        <>
          <p className="mb-1.5 mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Fillable fields
          </p>
          {(
            [
              ["signature", "Signature"],
              ["initial", "Initials"],
              ["date", "Date"],
              ["text", "Text field"],
            ] as const
          ).map(([type, label]) => (
            <Row
              key={type}
              Icon={IconSignature}
              label={label}
              hint="Placed on the page overlay"
              onClick={() => {
                onInsertField?.(type);
                onDone();
              }}
            />
          ))}
        </>
      ) : null}
      {visibleVariables.length > 0 ? (
        <>
          <p className="mb-1.5 mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Variables</p>
          {visibleVariables.map((key) => (
            <Row
              key={key}
              Icon={IconTextT}
              label={`{{${key}}}`}
              hint="Inline token"
              onClick={() => run((ed) => insertVariable(ed, key))}
            />
          ))}
        </>
      ) : null}
      <p className="mb-1.5 mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Content
      </p>
      <div className="max-h-80 overflow-y-auto">
        {visibleEntries
          .filter((entry) => entry.id === "text")
          .map((entry) => (
            <Row
              key={entry.id}
              Icon={entry.Icon}
              label={entry.label}
              hint={entry.hint}
              onClick={() => run(entry.run)}
            />
          ))}
        {showImage ? (
          <Row
            Icon={IconImage}
            label={uploading ? "Uploading…" : "Image"}
            hint="PNG, JPEG, WebP"
            onClick={() => fileInputRef.current?.click()}
          />
        ) : null}
        {showVideo ? (
          <Row Icon={IconVideo} label="Video" hint="YouTube link" onClick={() => setView("video")} />
        ) : null}
        {showTable ? (
          <Row Icon={IconTable} label="Table" hint="Rows and columns" onClick={() => setView("table")} />
        ) : null}
        {visibleEntries
          .filter((entry) => entry.id !== "text")
          .map((entry) => (
            <Row
              key={entry.id}
              Icon={entry.Icon}
              label={entry.label}
              hint={entry.hint}
              onClick={() => run(entry.run)}
            />
          ))}
      </div>
      {uploadError ? <p className="mt-1 px-1 text-xs text-red-600">{uploadError}</p> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onPickImage(file);
        }}
      />
    </Panel>
  );

  function submitVideo() {
    if (!editor) {
      return;
    }
    onBeforeInsert?.();
    if (!insertVideo(editor, videoUrl, insertPos)) {
      setVideoError("That does not look like a YouTube link.");
      return;
    }
    setVideoUrl("");
    onDone();
  }
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-64 rounded-lg border border-border bg-surface p-2 shadow-xl">{children}</div>
  );
}

function PanelTitle({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="rounded px-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
        aria-label="Back to element list"
      >
        ‹
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</p>
    </div>
  );
}

function Row({
  Icon,
  label,
  hint,
  onClick,
}: {
  Icon: (props: { className?: string }) => ReactElement;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );
}
