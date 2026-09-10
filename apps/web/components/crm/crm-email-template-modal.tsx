"use client";

import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { Indent } from "@/lib/editor/extensions/indent";
import { sanitizePastedHtml } from "@/lib/editor/paste";
import type { CrmEmailTemplateDto } from "@/lib/crm/email-templates";

const FIELD_OPTIONS = [
  { key: "first_name", label: "first name" },
  { key: "last_name", label: "last name" },
  { key: "full_name", label: "full name" },
  { key: "email", label: "email" },
  { key: "company_name", label: "company name" },
  { key: "title", label: "title" },
  { key: "sender_name", label: "Sender name" },
] as const;

function fieldPillHtml(key: string, label: string): string {
  return `<span data-email-field="${key}" style="display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:9999px;background:#eef2f7;color:#334155;font-size:0.875em;font-weight:500;" contenteditable="false">${label}</span>`;
}

function ToolbarButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-sm text-muted hover:bg-black/5 hover:text-foreground",
        active && "bg-black/10 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TemplateBodyToolbar({ editor }: { editor: Editor }) {
  useEditorEventTick(editor);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t border-border px-2 py-1.5">
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <label className="inline-flex h-7 items-center gap-1 rounded px-1 text-xs text-muted hover:bg-black/5">
        <span title="Text color">A</span>
        <input
          type="color"
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />
      </label>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ”
      </ToolbarButton>
      <ToolbarButton
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const next = window.prompt("Enter URL", previous ?? "https://");
          if (next === null) return;
          if (!next.trim()) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          const href = /^https?:\/\//i.test(next.trim()) ? next.trim() : `https://${next.trim()}`;
          editor.chain().focus().extendMarkRange("link").setLink({ href, target: "_blank" }).run();
        }}
      >
        🔗
      </ToolbarButton>
      <ToolbarButton title="Image" onClick={() => fileRef.current?.click()}>
        🖼
      </ToolbarButton>
      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        Tx
      </ToolbarButton>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
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

export type CrmEmailTemplateModalProps = {
  open: boolean;
  mode: "create" | "edit";
  template?: CrmEmailTemplateDto | null;
  templates?: CrmEmailTemplateDto[];
  initialName?: string;
  initialSubject?: string;
  initialBodyHtml?: string;
  onClose: () => void;
  onSaved: (template: CrmEmailTemplateDto) => void;
  onDeleted?: (templateId: string) => void;
};

export function CrmEmailTemplateModal({
  open,
  mode,
  template,
  templates = [],
  initialName = "",
  initialSubject = "",
  initialBodyHtml = "<p></p>",
  onClose,
  onSaved,
  onDeleted,
}: CrmEmailTemplateModalProps) {
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject);
  const [visibility, setVisibility] = useState<"PRIVATE" | "SHARED">("PRIVATE");
  const [selectedId, setSelectedId] = useState<string | null>(template?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent,
      Image.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your email template…" }),
    ],
    content: initialBodyHtml || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[220px] px-3 py-3 focus:outline-none",
      },
      transformPastedHTML: (html) => sanitizePastedHtml(html),
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const source = template;
    setSelectedId(source?.id ?? null);
    setName(source?.name ?? initialName);
    setSubject(source?.subject ?? initialSubject);
    setVisibility(source?.visibility ?? "PRIVATE");
    setError(null);
    editor?.commands.setContent(source?.bodyHtml ?? initialBodyHtml ?? "<p></p>");
  }, [open, template, initialName, initialSubject, initialBodyHtml, editor]);

  if (!open || !mounted) {
    return null;
  }

  async function loadTemplate(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/crm/email-templates/${id}`);
      const payload = (await response.json().catch(() => ({}))) as {
        template?: CrmEmailTemplateDto;
        error?: string;
      };
      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Could not load template.");
      }
      setSelectedId(payload.template.id);
      setName(payload.template.name);
      setSubject(payload.template.subject);
      setVisibility(payload.template.visibility);
      editor?.commands.setContent(payload.template.bodyHtml || "<p></p>");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load template.");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const bodyHtml = editor?.getHTML() ?? "<p></p>";
      const isUpdate = mode === "edit" && selectedId;
      const response = await fetch(
        isUpdate ? `/api/crm/email-templates/${selectedId}` : "/api/crm/email-templates",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, subject, bodyHtml, visibility }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        template?: CrmEmailTemplateDto;
        error?: string;
      };
      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Could not save template.");
      }
      onSaved(payload.template);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId) {
      onClose();
      return;
    }
    if (!window.confirm("Delete this email template?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/email-templates/${selectedId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete template.");
      }
      onDeleted?.(selectedId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete template.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-email-template-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="edit-email-template-title" className="text-base font-semibold text-foreground">
            Edit email template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-slate-50 hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {mode === "edit" && templates.length > 0 ? (
            <label className="block text-sm">
              <span className="text-muted">Template</span>
              <select
                value={selectedId ?? ""}
                onChange={(event) => {
                  if (event.target.value) {
                    void loadTemplate(event.target.value);
                  }
                }}
                className="mt-1 w-full rounded-md border border-border bg-white px-2.5 py-2 text-sm"
              >
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Template name:</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-border px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-border"
                placeholder="Follow up"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Visibility:</span>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "PRIVATE" | "SHARED")}
                className="mt-1 w-full rounded-md border border-border bg-white px-2.5 py-2 text-sm"
              >
                <option value="PRIVATE">🔒 Private</option>
                <option value="SHARED">Shared</option>
              </select>
            </label>
          </div>

          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            className="w-full rounded-md border border-border px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-border"
          />

          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-2">
              <select
                className="rounded-md border-0 bg-transparent px-1.5 py-1 text-sm font-semibold text-foreground hover:bg-slate-100/80"
                defaultValue=""
                onChange={(event) => {
                  const key = event.target.value;
                  event.target.value = "";
                  const field = FIELD_OPTIONS.find((item) => item.key === key);
                  if (!field || !editor) return;
                  editor.chain().focus().insertContent(fieldPillHtml(field.key, field.label)).run();
                }}
              >
                <option value="">Insert field</option>
                {FIELD_OPTIONS.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border-0 bg-transparent px-1.5 py-1 text-sm font-semibold text-foreground hover:bg-slate-100/80"
                defaultValue=""
                onChange={(event) => {
                  const value = event.target.value;
                  event.target.value = "";
                  if (!value || !editor) return;
                  const label =
                    value === "15"
                      ? "Book a 15-minute meeting"
                      : value === "30"
                        ? "Book a 30-minute meeting"
                        : "View my availability";
                  editor
                    .chain()
                    .focus()
                    .insertContent(`<p><a href="/app/contacts/calendar">${label}</a></p>`)
                    .run();
                }}
              >
                <option value="">Meeting scheduler</option>
                <option value="15">15-minute meeting</option>
                <option value="30">30-minute meeting</option>
                <option value="calendar">Open calendar</option>
              </select>
            </div>
            <EditorContent editor={editor} />
            {editor ? <TemplateBodyToolbar editor={editor} /> : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={busy || mode === "create" || !selectedId}
            onClick={() => void remove()}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
            className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
