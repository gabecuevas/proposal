"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { Indent } from "@/lib/editor/extensions/indent";
import { sanitizePastedHtml } from "@/lib/editor/paste";
import { CrmMention } from "@/lib/crm/crm-mention";
import {
  isNoteOverLimit,
  normalizeNoteHtml,
  noteSizePercent,
} from "@/lib/crm/notes-html";

export type CrmNoteMember = {
  userId: string;
  name: string;
  email: string;
};

type MentionState = {
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
};

type CrmNotesEditorProps = {
  value: string;
  onChange: (html: string) => void;
  /** Called after content is loaded/reset so parents can sync saved baselines. */
  onReady?: (html: string) => void;
  contentKey?: string;
  placeholder?: string;
  members?: CrmNoteMember[];
  currentUserId?: string;
  showActions?: boolean;
  dirty?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  className?: string;
  minHeightClassName?: string;
};

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
        "inline-flex h-7 w-7 items-center justify-center rounded text-sm text-muted hover:bg-black/5 hover:text-foreground disabled:opacity-40",
        active && "bg-black/10 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function readMention(editor: Editor, root: HTMLElement): MentionState | null {
  const { $from, empty } = editor.state.selection;
  if (!empty) {
    return null;
  }
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = textBefore.match(/@([\w.\- ]*)$/);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  if (query.length > 40) {
    return null;
  }
  const from = $from.pos - match[0].length;
  const to = $from.pos;
  const coords = editor.view.coordsAtPos(from);
  const rootRect = root.getBoundingClientRect();
  return {
    query,
    from,
    to,
    top: coords.bottom - rootRect.top + 4,
    left: Math.max(0, coords.left - rootRect.left),
  };
}

function ensureHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function NotesToolbar({
  editor,
  overLimit,
  percent,
  showActions,
  dirty,
  saving,
  onCancel,
  onSave,
  onRequestMention,
  onPickImage,
}: {
  editor: Editor;
  overLimit: boolean;
  percent: number;
  showActions?: boolean;
  dirty?: boolean;
  saving?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
  onRequestMention: () => void;
  onPickImage: () => void;
}) {
  useEditorEventTick(editor);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!infoRef.current?.contains(event.target as Node)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [infoOpen]);

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
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href, target: "_blank", rel: "noopener noreferrer" })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t border-border px-2 py-1.5">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
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
      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M14 11a5 5 0 00-7.07 0L5.52 12.41a5 5 0 007.07 7.07L14 18.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Mention" onClick={onRequestMention}>
        <span className="text-[13px] font-semibold">@</span>
      </ToolbarButton>
      <ToolbarButton title="Image" onClick={onPickImage}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M7 16l3.5-3.5L14 15l2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="5" cy="6" r="1.2" fill="currentColor" />
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="5" cy="18" r="1.2" fill="currentColor" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4 5.5h2v3.5H4M4 12.5h2.5M4 15.5h1.5V18H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Decrease indent"
        onClick={() => {
          if (editor.can().liftListItem("listItem")) {
            editor.chain().focus().liftListItem("listItem").run();
            return;
          }
          editor.chain().focus().decreaseIndent().run();
        }}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 6h16M10 12h10M10 18h10M8 15l-3-3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Increase indent"
        onClick={() => {
          if (editor.can().sinkListItem("listItem")) {
            editor.chain().focus().sinkListItem("listItem").run();
            return;
          }
          editor.chain().focus().increaseIndent().run();
        }}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h10M13 9l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <span className="relative text-[13px] font-semibold">
          T
          <span className="absolute -right-1.5 -top-0.5 text-[9px]">x</span>
        </span>
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex w-16 items-center" title={`${percent}% of note size used`}>
          <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className={cn("h-full rounded-full transition-all", overLimit ? "bg-red-500" : "bg-slate-400")}
              style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>

        <div ref={infoRef} className="relative">
          <button
            type="button"
            title="Note size limit"
            aria-label="Note size limit"
            onClick={() => setInfoOpen((value) => !value)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
          >
            i
          </button>
          {infoOpen ? (
            <div className="absolute bottom-full right-0 z-40 mb-2 w-72 rounded-md border border-border bg-white p-3 text-left shadow-lg">
              <p className="text-sm font-semibold text-foreground">Note size limit</p>
              <p className="mt-1 text-sm text-foreground">Note size used: {percent}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full rounded-full", overLimit ? "bg-red-500" : "bg-slate-400")}
                  style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                The maximum note size limit is 100KB. It&apos;s affected by text length and text format. You are not
                able to save notes when it&apos;s over the size limit.
              </p>
            </div>
          ) : null}
        </div>

        {showActions ? (
          <>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={onCancel}
              className="rounded-md border border-border bg-white px-3 py-1 text-sm text-foreground hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!dirty || overLimit || saving}
              onClick={onSave}
              className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CrmNotesEditor({
  value,
  onChange,
  onReady,
  contentKey,
  placeholder = "Write a note…",
  members: membersProp,
  currentUserId,
  showActions = false,
  dirty = false,
  onCancel,
  onSave,
  saving = false,
  className,
  minHeightClassName = "min-h-[120px]",
}: CrmNotesEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressUpdateRef = useRef(true);
  const [members, setMembers] = useState<CrmNoteMember[]>(membersProp ?? []);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  useEffect(() => {
    if (membersProp) {
      setMembers(membersProp);
      return;
    }
    void (async () => {
      const response = await fetch("/api/workspace/members");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        members: Array<{ userId: string; name: string; email: string }>;
      };
      setMembers(payload.members);
    })();
  }, [membersProp]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
          class: "crm-note-link text-primary underline",
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "max-h-48 max-w-full rounded",
        },
      }),
      Placeholder.configure({ placeholder }),
      Indent,
      CrmMention,
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "crm-notes-prose px-3 py-2 text-sm text-foreground outline-none",
          minHeightClassName,
          "[&_a]:text-primary [&_a]:underline",
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_p]:my-0.5",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
      transformPastedHTML: sanitizePastedHtml,
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a");
        if (anchor instanceof HTMLAnchorElement && anchor.href) {
          event.preventDefault();
          window.open(anchor.href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (suppressUpdateRef.current) {
        return;
      }
      onChange(normalizeNoteHtml(current.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    suppressUpdateRef.current = true;
    editor.commands.setContent(value || "", false);
    const html = normalizeNoteHtml(editor.getHTML());
    onReady?.(html);
    onChange(html);
    queueMicrotask(() => {
      suppressUpdateRef.current = false;
    });
    // contentKey changes when switching records or after Cancel/reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, editor]);

  const syncMention = useCallback(() => {
    if (!editor || !rootRef.current) {
      setMention(null);
      return;
    }
    setMention(readMention(editor, rootRef.current));
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.on("selectionUpdate", syncMention);
    editor.on("update", syncMention);
    syncMention();
    return () => {
      editor.off("selectionUpdate", syncMention);
      editor.off("update", syncMention);
    };
  }, [editor, syncMention]);

  const filteredMembers = useMemo(() => {
    if (!mention) {
      return [];
    }
    const query = mention.query.trim().toLowerCase();
    return members
      .filter((member) => {
        if (!query) {
          return true;
        }
        return (
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [members, mention]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.query, mention?.from]);

  const insertMention = useCallback(
    (member: CrmNoteMember) => {
      if (!editor || !mention) {
        return;
      }
      editor
        .chain()
        .focus()
        .deleteRange({ from: mention.from, to: mention.to })
        .insertCrmMention({ userId: member.userId, label: member.name })
        .run();
      setMention(null);
    },
    [editor, mention],
  );

  useEffect(() => {
    if (!mention || !editor) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMention(null);
        return;
      }
      if (!filteredMembers.length) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) => (index + 1) % filteredMembers.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((index) => (index - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const member = filteredMembers[mentionIndex];
        if (member) {
          insertMention(member);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [editor, filteredMembers, insertMention, mention, mentionIndex]);

  const html = editor ? editor.getHTML() : value;
  const percent = noteSizePercent(html);
  const overLimit = isNoteOverLimit(html);

  const requestMention = () => {
    if (!editor) {
      return;
    }
    editor.chain().focus().insertContent("@").run();
  };

  const onPickImage = () => {
    fileInputRef.current?.click();
  };

  const onImageSelected = async (file: File | null) => {
    if (!file || !editor) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    editor.chain().focus().setImage({ src: dataUrl }).run();
  };

  if (!editor) {
    return (
      <div className={cn("rounded-md border border-border bg-slate-100", minHeightClassName, className)} />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative rounded-md border border-border bg-slate-100", className)}
    >
      <EditorContent editor={editor} />
      <NotesToolbar
        editor={editor}
        overLimit={overLimit}
        percent={percent}
        showActions={showActions}
        dirty={dirty}
        saving={saving}
        onCancel={onCancel}
        onSave={onSave}
        onRequestMention={requestMention}
        onPickImage={onPickImage}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          void onImageSelected(file);
        }}
      />
      {mention ? (
        <div
          className="absolute z-40 max-h-56 w-64 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg"
          style={{ top: mention.top, left: mention.left }}
        >
          {filteredMembers.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No users found</p>
          ) : (
            filteredMembers.map((member, index) => (
              <button
                key={member.userId}
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                  index === mentionIndex && "bg-slate-50",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(member);
                }}
              >
                <span className="font-medium text-foreground">
                  {member.userId === currentUserId ? `${member.name} (You)` : member.name}
                </span>
                <span className="text-xs text-muted">{member.email}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
      {overLimit && !showActions ? (
        <p className="px-3 pb-2 text-xs text-red-600">Note exceeds the 100KB size limit and cannot be saved.</p>
      ) : null}
    </div>
  );
}

export function noteSaveBlocked(html: string): boolean {
  return isNoteOverLimit(html);
}
