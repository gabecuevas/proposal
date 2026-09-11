"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@repo/ui/utils";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { FONT_SIZES } from "@/lib/editor/extensions/font-size";
import { setFontFamily, setFontSize } from "@/lib/editor/commands/editor-commands";

const EMAIL_FONT_FAMILIES = [
  { id: "", label: "Default" },
  { id: "Arial, Helvetica, sans-serif", label: "Arial" },
  { id: "Georgia, serif", label: "Georgia" },
  { id: '"Times New Roman", Times, serif', label: "Times New Roman" },
  { id: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { id: '"Courier New", Courier, monospace', label: "Courier New" },
] as const;

function ensureHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-slate-700 hover:bg-slate-200/80 hover:text-foreground disabled:opacity-40",
        active && "bg-slate-200 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />;
}

function ToolbarMenu({
  title,
  label,
  active,
  children,
}: {
  title: string;
  label: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-7 items-center gap-0.5 rounded px-1.5 text-slate-700 hover:bg-slate-200/80",
          (open || active) && "bg-slate-200 text-foreground",
        )}
      >
        {label}
        <svg className="h-2.5 w-2.5 text-muted" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-20 mb-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-50",
        active && "bg-slate-100 font-medium",
      )}
    >
      {children}
    </button>
  );
}

export function CrmEmailComposerToolbar({ editor }: { editor: Editor }) {
  useEditorEventTick(editor);
  const fileRef = useRef<HTMLInputElement>(null);
  const color = (editor.getAttributes("textStyle").color as string | undefined) || "#334155";
  const fontFamily = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";
  const fontSize = (editor.getAttributes("textStyle").fontSize as string | undefined) || "";

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("Enter URL", previous ?? "https://");
    if (next === null) {
      return;
    }
    if (!next.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = ensureHttpUrl(next);
    if (!href) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href, target: "_blank" }).run();
  };

  const decreaseIndent = () => {
    if (editor.can().liftListItem("listItem")) {
      editor.chain().focus().liftListItem("listItem").run();
      return;
    }
    editor.chain().focus().decreaseIndent().run();
  };

  const increaseIndent = () => {
    if (editor.can().sinkListItem("listItem")) {
      editor.chain().focus().sinkListItem("listItem").run();
      return;
    }
    editor.chain().focus().increaseIndent().run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t border-border bg-slate-50/80 px-2 py-1.5">
      <ToolbarButton
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 7L4 12l5 5M4 12h10a5 5 0 010 10h-2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 7l5 5-5 5M20 12H10a5 5 0 000 10h2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarMenu
        title="Font family"
        active={Boolean(fontFamily)}
        label={
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-[11px] font-semibold text-white">
            A
          </span>
        }
      >
        {EMAIL_FONT_FAMILIES.map((font) => (
          <MenuItem
            key={font.label}
            active={fontFamily === font.id || (!fontFamily && !font.id)}
            onClick={() => setFontFamily(editor, font.id)}
          >
            <span style={{ fontFamily: font.id || "inherit" }}>{font.label}</span>
          </MenuItem>
        ))}
      </ToolbarMenu>

      <ToolbarDivider />

      <ToolbarMenu
        title="Font size"
        active={Boolean(fontSize)}
        label={
          <span className="inline-flex items-end gap-0.5 px-0.5 font-semibold leading-none">
            <span className="text-[13px]">T</span>
            <span className="text-[9px]">T</span>
          </span>
        }
      >
        <MenuItem active={!fontSize} onClick={() => setFontSize(editor, "")}>
          Default
        </MenuItem>
        {FONT_SIZES.map((size) => (
          <MenuItem key={size} active={fontSize === size} onClick={() => setFontSize(editor, size)}>
            {size.replace("px", "")}
          </MenuItem>
        ))}
      </ToolbarMenu>

      <ToolbarDivider />

      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="text-sm font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="text-sm italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="text-sm underline">U</span>
      </ToolbarButton>

      <label
        title="Text color"
        className="relative inline-flex h-7 cursor-pointer items-center gap-0.5 rounded px-1.5 text-slate-700 hover:bg-slate-200/80"
      >
        <span className="flex flex-col items-center leading-none">
          <span className="text-sm font-semibold">A</span>
          <span className="mt-0.5 h-0.5 w-3.5 rounded-sm" style={{ backgroundColor: color }} />
        </span>
        <svg className="h-2.5 w-2.5 text-muted" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#334155"}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />
      </label>

      <ToolbarDivider />

      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 6h11M10 12h11M10 18h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4 5h2v4H4M4 12h2.5M4 15h1.5V18H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 6h11M10 12h11M10 18h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="5" cy="6" r="1.2" fill="currentColor" />
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="5" cy="18" r="1.2" fill="currentColor" />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Decrease indent" onClick={decreaseIndent}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6h16M10 12h10M10 18h10M8 15l-3-3 3-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Increase indent" onClick={increaseIndent}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6h16M4 12h10M4 18h10M16 9l3 3-3 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7.5 11.5c0-2.2 1.3-3.7 3.5-4.3l-.5 1.8c-1 .4-1.5 1.1-1.5 2h2.2V17H7.5v-5.5zm8 0c0-2.2 1.3-3.7 3.5-4.3l-.5 1.8c-1 .4-1.5 1.1-1.5 2H19V17h-3.5v-5.5z" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M14 11a5 5 0 00-7.07 0L5.52 12.41a5 5 0 007.07 7.07L14 18.1"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Image" onClick={() => fileRef.current?.click()}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <path d="M7 16l3.5-3.5L14 15l2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="4" cy="12" r="1.4" fill="currentColor" />
          <circle cx="20" cy="12" r="1.4" fill="currentColor" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().unsetFontFamily().unsetFontSize().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 5h9M10.5 5v12M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 19L19 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              editor.chain().focus().setImage({ src: reader.result }).run();
            }
          };
          reader.readAsDataURL(file);
        }}
      />
    </div>
  );
}
