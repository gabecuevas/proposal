"use client";

import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CrmEmailComposerToolbar } from "@/components/crm/crm-email-composer-toolbar";
import { Indent } from "@/lib/editor/extensions/indent";
import { FontSize } from "@/lib/editor/extensions/font-size";
import { sanitizeEmailFriendlyHtml } from "@/lib/editor/paste";
import type { CrmEmailSignatureDto } from "@/lib/crm/email-signatures";

export type CrmEmailSignatureModalProps = {
  open: boolean;
  accountId: string;
  signature?: CrmEmailSignatureDto | null;
  onClose: () => void;
  onSaved: (signature: CrmEmailSignatureDto) => void;
};

export function CrmEmailSignatureModal({
  open,
  accountId,
  signature = null,
  onClose,
  onSaved,
}: CrmEmailSignatureModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlPanelOpen, setHtmlPanelOpen] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState("");
  const [htmlError, setHtmlError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent,
      Image.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Write your signature…" }),
    ],
    content: "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[180px] px-3 py-3 focus:outline-none",
      },
      transformPastedHTML: (html) => sanitizeEmailFriendlyHtml(html),
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setName(signature?.name ?? "");
    setError(null);
    setHtmlPanelOpen(false);
    setHtmlDraft("");
    setHtmlError(null);
    editor?.commands.setContent(signature?.bodyHtml || "<p></p>");
  }, [open, signature, editor]);

  if (!open || !mounted) {
    return null;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const bodyHtml = editor?.getHTML() || "<p></p>";
      const response = await fetch(
        signature ? `/api/crm/email-signatures/${signature.id}` : "/api/crm/email-signatures",
        {
          method: signature ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            name,
            bodyHtml,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        signature?: CrmEmailSignatureDto;
        error?: string;
      };
      if (!response.ok || !payload.signature) {
        throw new Error(payload.error || "Could not save signature.");
      }
      onSaved(payload.signature);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save signature.");
    } finally {
      setBusy(false);
    }
  }

  function insertMeeting(kind: string) {
    if (!editor) return;
    const label =
      kind === "15" ? "Book a 15-minute meeting" : kind === "30" ? "Book a 30-minute meeting" : "View my availability";
    editor.chain().focus().insertContent(`<p><a href="/app/contacts/calendar">${label}</a></p>`).run();
  }

  function applyInsertedHtml() {
    if (!editor) return;
    const raw = htmlDraft.trim();
    if (!raw) {
      setHtmlError("Paste some HTML to insert.");
      return;
    }
    const clean = sanitizeEmailFriendlyHtml(raw);
    if (!clean.trim()) {
      setHtmlError("That markup couldn’t be used. Try email-safe HTML (tables, links, styled text, images).");
      return;
    }
    const ok = editor
      .chain()
      .focus()
      .insertContent(clean, {
        parseOptions: { preserveWhitespace: "full" },
      })
      .run();
    if (!ok) {
      setHtmlError("Could not insert that HTML into the editor.");
      return;
    }
    setHtmlPanelOpen(false);
    setHtmlDraft("");
    setHtmlError(null);
  }

  return createPortal(
    <div className="app-theme fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-signature-modal-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="email-signature-modal-title" className="text-base font-semibold text-foreground">
            {signature ? "Edit email signature" : "Add email signature"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
              i
            </span>
            <p>Signatures added to this email account can be inserted when composing CRM emails.</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Signature name</span>
            <input
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-primary/20 focus:border-primary/40 focus:ring-2"
              placeholder="e.g. Default"
            />
            <span className="text-xs text-muted">Max 40 characters</span>
          </label>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-1.5">
              <select
                className="h-8 rounded-md border-0 bg-transparent px-1 text-sm text-foreground outline-none"
                defaultValue=""
                aria-label="Meeting scheduler"
                onChange={(event) => {
                  if (event.target.value) {
                    insertMeeting(event.target.value);
                    event.target.value = "";
                  }
                }}
              >
                <option value="">Meeting scheduler</option>
                <option value="15">15-minute meeting</option>
                <option value="30">30-minute meeting</option>
                <option value="calendar">Open calendar</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setHtmlError(null);
                  setHtmlPanelOpen(true);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
                title="Insert HTML"
              >
                <span className="font-mono text-xs">&lt;/&gt;</span>
                Insert HTML
              </button>
            </div>
            <EditorContent editor={editor} />
            {editor ? <CrmEmailComposerToolbar editor={editor} /> : null}
          </div>

          {htmlPanelOpen ? (
            <div className="space-y-2 rounded-md border border-border bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Insert HTML</p>
                <button
                  type="button"
                  onClick={() => {
                    setHtmlPanelOpen(false);
                    setHtmlError(null);
                  }}
                  className="text-xs font-medium text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-muted">
                Paste email-friendly markup (tables, links, images, styled text). Scripts and unsafe tags are
                removed.
              </p>
              <textarea
                value={htmlDraft}
                onChange={(event) => setHtmlDraft(event.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={`<table>\n  <tr>\n    <td>Your Name</td>\n  </tr>\n</table>`}
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs text-foreground outline-none ring-primary/20 focus:border-primary/40 focus:ring-2"
              />
              {htmlError ? <p className="text-sm text-red-600">{htmlError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHtmlPanelOpen(false);
                    setHtmlDraft("");
                    setHtmlError(null);
                  }}
                  className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyInsertedHtml}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
                >
                  Insert
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
