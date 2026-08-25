"use client";

import type { Editor } from "@tiptap/core";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { getBlockClipboard } from "@/lib/editor/block-clipboard";
import {
  clearFormatting,
  getEditorFormatState,
  indentSelection,
  outdentSelection,
  redo,
  runClipboardAction,
  selectAll,
  setAlignment,
  setBlockStyle,
  setFontSize,
  toggleBold,
  toggleBulletList,
  toggleItalic,
  toggleOrderedList,
  toggleUnderline,
  undo,
} from "@/lib/editor/commands/editor-commands";
import { BLOCK_STYLES } from "@/lib/editor/commands/format-presets";
import { FONT_SIZES } from "@/lib/editor/extensions/font-size";
import { insertNodeAfter } from "@/lib/editor/library-blocks";
import { PAGE_SIZES, type PageSizeId } from "@/lib/editor/page-geometry";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { ContentLibraryModal } from "./content-library-modal";
import { CreatorFormatToolbar } from "./creator-format-toolbar";
import { IconArrowLeft, IconClose, IconKebab, IconSend } from "./creator-icons";
import { ElementMenu } from "./element-menu";

export type CreatorMoreItem = {
  label: string;
  onClick: () => void;
};

type MenuId = "file" | "edit" | "insert" | "view" | "format" | "more" | "settings" | null;

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  saveStatus: string;
  closeHref: string;
  editor?: Editor | null;
  pageSize?: PageSizeId;
  onPageSizeChange?: (size: PageSizeId) => void;
  fileItems?: CreatorMoreItem[];
  onSave?: () => void;
  onPrint?: () => void;
  onInsertField?: (type: SignerFieldEditorType) => void;
  variableKeys?: string[];
  statusLabel?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  moreItems?: CreatorMoreItem[];
  extraActions?: ReactNode;
};

export function CreatorHeader({
  name,
  onNameChange,
  saveStatus,
  closeHref,
  editor = null,
  pageSize = "letter",
  onPageSizeChange,
  fileItems,
  onSave,
  onPrint,
  onInsertField,
  variableKeys,
  statusLabel = "Draft",
  primaryActionLabel = "Review and send",
  onPrimaryAction,
  moreItems,
  extraActions,
}: Props) {
  const tick = useEditorEventTick(editor);
  const saved = saveStatus === "Saved" || saveStatus === "Idle" || saveStatus === "Document sent." || saveStatus.startsWith("Saved");
  const [open, setOpen] = useState<MenuId>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  void tick;
  const format = editor ? getEditorFormatState(editor) : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function toggle(id: MenuId) {
    setOpen((current) => (current === id ? null : id));
  }

  function runAndClose(action: () => void) {
    action();
    setOpen(null);
  }

  return (
    <header className="shrink-0 border-b border-border bg-surface">
      <div className="flex h-12 items-center justify-between gap-4 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={nameRef}
            className="min-w-0 max-w-md truncate bg-transparent text-sm font-semibold text-foreground outline-none"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-label="Document name"
          />
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-muted">{statusLabel}</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${saved ? "bg-emerald-500" : "bg-amber-400"}`}
            title={saveStatus}
            aria-label={saveStatus}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-muted md:flex">
            <span>Step 2 of 3</span>
            <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth="2"
                  strokeDasharray="33.5 50.3"
                  strokeLinecap="round"
                  transform="rotate(-90 10 10)"
                />
              </svg>
            </span>
          </span>
          {extraActions}
          <Link
            href={closeHref}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-slate-50"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
          >
            <IconSend className="h-3.5 w-3.5" />
            {primaryActionLabel}
          </button>
          {moreItems && moreItems.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => toggle("more")}
                className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground"
                aria-label="More"
                aria-expanded={open === "more"}
              >
                <IconKebab />
              </button>
              {open === "more" ? (
                <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-border bg-surface py-1 text-sm shadow-lg">
                  {moreItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        setOpen(null);
                        item.onClick();
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <button type="button" className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground" aria-label="More">
              <IconKebab />
            </button>
          )}
          <Link href={closeHref} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground" aria-label="Close">
            <IconClose />
          </Link>
        </div>
      </div>

      <div className="relative flex h-8 items-center gap-1 px-3 text-[12px] text-muted" ref={barRef}>
        <MenuTrigger label="File" open={open === "file" || open === "settings"} onClick={() => toggle("file")} />
        <MenuTrigger label="Edit" open={open === "edit"} onClick={() => toggle("edit")} />
        <MenuTrigger label="Insert" open={open === "insert"} onClick={() => toggle("insert")} />
        <MenuTrigger label="View" open={open === "view"} onClick={() => toggle("view")} />
        <MenuTrigger label="Format" open={open === "format"} onClick={() => toggle("format")} />

        {open === "file" ? (
          <MenuPanel>
            {onSave ? <MenuItem onClick={() => runAndClose(onSave)}>Save</MenuItem> : null}
            {(fileItems ?? []).map((item) => (
              <MenuItem
                key={item.label}
                onClick={() => {
                  setOpen(null);
                  item.onClick();
                }}
              >
                {item.label}
              </MenuItem>
            ))}
            {onPrint ? <MenuItem onClick={() => runAndClose(onPrint)}>Print</MenuItem> : null}
            <MenuItem
              onClick={() => {
                nameRef.current?.focus();
                nameRef.current?.select();
                setOpen(null);
              }}
            >
              Rename
            </MenuItem>
            <MenuItem onClick={() => setOpen("settings")}>Document settings</MenuItem>
          </MenuPanel>
        ) : null}

        {open === "settings" ? (
          <MenuPanel>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Page size</p>
            {(Object.keys(PAGE_SIZES) as PageSizeId[]).map((id) => (
              <MenuItem
                key={id}
                active={pageSize === id}
                onClick={() => {
                  onPageSizeChange?.(id);
                  setOpen(null);
                }}
              >
                {PAGE_SIZES[id].label}
              </MenuItem>
            ))}
          </MenuPanel>
        ) : null}

        {open === "edit" ? (
          <MenuPanel>
            <MenuItem disabled={!format?.canUndo} onClick={() => editor && runAndClose(() => undo(editor))}>
              Undo
            </MenuItem>
            <MenuItem disabled={!format?.canRedo} onClick={() => editor && runAndClose(() => redo(editor))}>
              Redo
            </MenuItem>
            <MenuItem onClick={() => editor && runAndClose(() => void runClipboardAction(editor, "cut"))}>Cut</MenuItem>
            <MenuItem onClick={() => editor && runAndClose(() => void runClipboardAction(editor, "copy"))}>Copy</MenuItem>
            <MenuItem onClick={() => editor && runAndClose(() => void runClipboardAction(editor, "paste"))}>Paste</MenuItem>
            <MenuItem onClick={() => editor && runAndClose(() => selectAll(editor))}>Select all</MenuItem>
            <MenuItem
              disabled={!getBlockClipboard()}
              onClick={() => {
                const node = getBlockClipboard();
                if (editor && node) {
                  insertNodeAfter(editor, node);
                }
                setOpen(null);
              }}
            >
              Paste element
            </MenuItem>
          </MenuPanel>
        ) : null}

        {open === "insert" ? (
          <div className="absolute left-16 top-8 z-40">
            <ElementMenu
              editor={editor}
              onDone={() => setOpen(null)}
              onOpenLibrary={() => {
                setOpen(null);
                setLibraryOpen(true);
              }}
              onInsertField={onInsertField}
              variableKeys={variableKeys}
            />
          </div>
        ) : null}

        {open === "view" ? (
          <MenuPanel>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Page size</p>
            {(Object.keys(PAGE_SIZES) as PageSizeId[]).map((id) => (
              <MenuItem
                key={id}
                active={pageSize === id}
                onClick={() => {
                  onPageSizeChange?.(id);
                  setOpen(null);
                }}
              >
                {PAGE_SIZES[id].label}
              </MenuItem>
            ))}
          </MenuPanel>
        ) : null}

        {open === "format" && editor ? (
          <MenuPanel>
            {BLOCK_STYLES.map((style) => (
              <MenuItem
                key={style.id}
                active={format?.blockStyle === style.id}
                onClick={() => runAndClose(() => setBlockStyle(editor, style.id))}
              >
                {style.label}
              </MenuItem>
            ))}
            <MenuItem active={format?.bold} onClick={() => runAndClose(() => toggleBold(editor))}>
              Bold
            </MenuItem>
            <MenuItem active={format?.italic} onClick={() => runAndClose(() => toggleItalic(editor))}>
              Italic
            </MenuItem>
            <MenuItem active={format?.underline} onClick={() => runAndClose(() => toggleUnderline(editor))}>
              Underline
            </MenuItem>
            <MenuItem active={format?.bulletList} onClick={() => runAndClose(() => toggleBulletList(editor))}>
              Bulleted list
            </MenuItem>
            <MenuItem active={format?.orderedList} onClick={() => runAndClose(() => toggleOrderedList(editor))}>
              Numbered list
            </MenuItem>
            <MenuItem active={format?.align === "left"} onClick={() => runAndClose(() => setAlignment(editor, "left"))}>
              Align left
            </MenuItem>
            <MenuItem
              active={format?.align === "center"}
              onClick={() => runAndClose(() => setAlignment(editor, "center"))}
            >
              Align center
            </MenuItem>
            <MenuItem active={format?.align === "right"} onClick={() => runAndClose(() => setAlignment(editor, "right"))}>
              Align right
            </MenuItem>
            <MenuItem active={format?.align === "justify"} onClick={() => runAndClose(() => setAlignment(editor, "justify"))}>
              Justify
            </MenuItem>
            <MenuItem onClick={() => runAndClose(() => indentSelection(editor))}>Increase indent</MenuItem>
            <MenuItem onClick={() => runAndClose(() => outdentSelection(editor))}>Decrease indent</MenuItem>
            {FONT_SIZES.map((size) => (
              <MenuItem
                key={size}
                active={format?.fontSize === size}
                onClick={() => runAndClose(() => setFontSize(editor, size))}
              >
                Size {size.replace("px", "")}
              </MenuItem>
            ))}
            <MenuItem onClick={() => runAndClose(() => clearFormatting(editor))}>Clear formatting</MenuItem>
          </MenuPanel>
        ) : null}
      </div>

      <CreatorFormatToolbar editor={editor} />
      <ContentLibraryModal editor={editor} open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </header>
  );
}

function MenuTrigger({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-foreground ${
        open ? "bg-slate-100 text-foreground" : ""
      }`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MenuPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-3 top-8 z-40 max-h-80 min-w-48 overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm text-foreground shadow-lg">
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`block w-full px-3 py-1.5 text-left disabled:opacity-40 ${
        active ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
