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
import LinkNext from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { Indent } from "@/lib/editor/extensions/indent";
import { FontSize } from "@/lib/editor/extensions/font-size";
import { sanitizeEmailFriendlyHtml } from "@/lib/editor/paste";
import type { CrmEmailAccountDto } from "@/lib/crm/emails";
import {
  applyEmailTemplateMergeFields,
  type CrmEmailTemplateDto,
} from "@/lib/crm/email-templates";
import type { CrmEmailSignatureDto } from "@/lib/crm/email-signatures";
import { CrmEmailComposerToolbar } from "@/components/crm/crm-email-composer-toolbar";
import { CrmEmailTemplateModal } from "@/components/crm/crm-email-template-modal";
import { CrmEmailTemplateManageModal } from "@/components/crm/crm-email-template-manage-modal";
import { CrmEmailTemplatePicker } from "@/components/crm/crm-email-template-picker";

export type CrmEmailMergeFields = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
  title?: string;
};

export type CrmEmailRecipientOption = {
  id: string;
  email: string;
  name: string;
  isPrimary?: boolean;
};

export type CrmEmailComposerProps = {
  recordType: "contact" | "lead" | "company";
  recordId?: string;
  /** Linked company used to load contact recipient options. */
  companyId?: string | null;
  primaryContactId?: string | null;
  defaultTo?: string[];
  mergeFields?: CrmEmailMergeFields;
  className?: string;
  onSent?: () => void;
};

type AttachmentDraft = {
  id: string;
  filename: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
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
        className,
      )}
    >
      {children}
    </button>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-3.5 w-3.5", className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuietSelect({
  value,
  onChange,
  children,
  widthCh,
  className,
  "aria-label": ariaLabel,
  defaultValue,
  tightChevron = false,
}: {
  value?: string;
  defaultValue?: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  widthCh?: number;
  className?: string;
  "aria-label"?: string;
  /** Pull the dropdown chevron closer to the selected text. */
  tightChevron?: boolean;
}) {
  return (
    <div className={cn("relative inline-flex max-w-full items-center", className)}>
      <select
        {...(value !== undefined ? { value } : { defaultValue })}
        aria-label={ariaLabel}
        onChange={onChange}
        style={widthCh ? { width: `${widthCh}ch` } : undefined}
        className={cn(
          "max-w-full cursor-pointer appearance-none rounded-md border-0 bg-transparent py-1 pl-0 text-sm font-semibold text-foreground outline-none",
          tightChevron ? "pr-4" : "pr-7",
          "hover:bg-slate-100/80 focus-visible:bg-slate-100/80 focus-visible:ring-1 focus-visible:ring-border/60",
        )}
      >
        {children}
      </select>
      <ChevronDownIcon
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted",
          tightChevron ? "right-0.5" : "right-2",
        )}
      />
    </div>
  );
}

function EmailChip({
  email,
  onRemove,
}: {
  email: string;
  onRemove: () => void;
}) {
  return (
    <span className="group inline-flex max-w-full items-center gap-1 rounded-md py-0.5 pr-1 text-sm font-semibold text-foreground hover:bg-slate-100/80">
      <span className="truncate">{email}</span>
      <button
        type="button"
        aria-label={`Remove ${email}`}
        className="rounded px-0.5 text-muted opacity-70 hover:text-foreground group-hover:opacity-100"
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  );
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

const FIELD_LABEL_CLASS = "w-10 shrink-0 text-sm text-muted";

function EmailChipRow({
  label,
  emails,
  onChange,
  inputValue,
  onInputChange,
  onSubmitInput,
  trailing,
}: {
  label: string;
  emails: string[];
  onChange: (next: string[]) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmitInput: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
      <span className={cn(FIELD_LABEL_CLASS, "pt-0")}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {emails.map((email) => (
          <EmailChip
            key={email}
            email={email}
            onRemove={() => onChange(emails.filter((item) => item !== email))}
          />
        ))}
        <input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
              event.preventDefault();
              onSubmitInput();
            } else if (event.key === "Backspace" && !inputValue && emails.length) {
              onChange(emails.slice(0, -1));
            }
          }}
          onBlur={onSubmitInput}
          placeholder={emails.length ? "" : "Add recipients"}
          className="min-w-[10rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted"
        />
      </div>
      {trailing}
    </div>
  );
}

export function CrmEmailComposer({
  recordType,
  recordId,
  companyId = null,
  primaryContactId = null,
  defaultTo = [],
  mergeFields = {},
  className,
  onSent,
}: CrmEmailComposerProps) {
  const [accounts, setAccounts] = useState<CrmEmailAccountDto[]>([]);
  const [templates, setTemplates] = useState<CrmEmailTemplateDto[]>([]);
  const [templateModal, setTemplateModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    template?: CrmEmailTemplateDto | null;
    fromDraft?: boolean;
  }>({ open: false, mode: "create" });
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [signatures, setSignatures] = useState<CrmEmailSignatureDto[]>([]);
  const [signatureMenuOpen, setSignatureMenuOpen] = useState(false);
  const signatureMenuRef = useRef<HTMLDivElement>(null);
  const [recipientOptions, setRecipientOptions] = useState<CrmEmailRecipientOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState<string[]>(defaultTo);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [privateSend, setPrivateSend] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [toInitialized, setToInitialized] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);

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
      Placeholder.configure({ placeholder: "Write your email…" }),
    ],
    content: bodyHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[160px] px-3 py-3 focus:outline-none",
      },
      transformPastedHTML: (html) => sanitizeEmailFriendlyHtml(html),
    },
    onUpdate: ({ editor: current }) => {
      setBodyHtml(current.getHTML());
    },
  });

  useEffect(() => {
    setToInitialized(false);
  }, [recordId, companyId, primaryContactId, defaultTo.join("|")]);

  const loadTemplates = useCallback(async (q?: string) => {
    try {
      const params = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const response = await fetch(`/api/crm/email-templates${params}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { templates?: CrmEmailTemplateDto[] };
      setTemplates(payload.templates ?? []);
    } catch {
      // leave existing list
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const accountsRes = await fetch("/api/crm/email-accounts");
        if (accountsRes.ok) {
          const payload = (await accountsRes.json()) as { accounts?: CrmEmailAccountDto[] };
          const list = payload.accounts ?? [];
          setAccounts(list);
          const preferred = list.find((item) => item.isDefault) ?? list[0];
          if (preferred) {
            setAccountId(preferred.id);
          }
        }
      } catch {
        setAccounts([]);
      }
    })();
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accountId) {
        setSignatures([]);
        return;
      }
      try {
        const response = await fetch(`/api/crm/email-signatures?accountId=${encodeURIComponent(accountId)}`);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { signatures?: CrmEmailSignatureDto[] };
        if (!cancelled) {
          setSignatures(payload.signatures ?? []);
        }
      } catch {
        if (!cancelled) {
          setSignatures([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (!signatureMenuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!signatureMenuRef.current?.contains(event.target as Node)) {
        setSignatureMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [signatureMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolvedCompanyId =
        companyId || (recordType === "company" ? recordId : null) || null;
      let resolvedPrimaryId = primaryContactId;

      if (recordType === "company" && recordId && !resolvedPrimaryId) {
        try {
          const companyRes = await fetch(`/api/companies/${recordId}`);
          if (companyRes.ok) {
            const payload = (await companyRes.json()) as {
              company?: { primary_contact_id?: string | null };
            };
            resolvedPrimaryId = payload.company?.primary_contact_id ?? null;
          }
        } catch {
          // ignore — fall back to defaultTo
        }
      }

      if (!resolvedCompanyId) {
        if (!cancelled) {
          setRecipientOptions([]);
          if (!toInitialized) {
            setTo(defaultTo.filter(Boolean));
            setToInitialized(true);
          }
        }
        return;
      }

      try {
        const response = await fetch(`/api/contacts?companyId=${resolvedCompanyId}&limit=100`);
        if (!response.ok) {
          throw new Error("Failed to load contacts");
        }
        const payload = (await response.json()) as {
          contacts?: Array<{
            id: string;
            full_name?: string;
            first_name?: string;
            last_name?: string;
            email?: string;
          }>;
        };
        const options = (payload.contacts ?? [])
          .map((contact) => {
            const email = contact.email?.trim().toLowerCase() ?? "";
            if (!email) {
              return null;
            }
            const option: CrmEmailRecipientOption = {
              id: contact.id,
              email,
              name:
                contact.full_name?.trim() ||
                [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
                email,
              isPrimary: Boolean(resolvedPrimaryId && contact.id === resolvedPrimaryId),
            };
            return option;
          })
          .filter((item): item is CrmEmailRecipientOption => item !== null);

        if (cancelled) {
          return;
        }
        setRecipientOptions(options);

        if (!toInitialized) {
          const primary = options.find((item) => item.isPrimary);
          const fallback = defaultTo.map((item) => item.trim().toLowerCase()).find(Boolean);
          const next = primary?.email || fallback || options[0]?.email;
          setTo(next ? [next] : []);
          setToInitialized(true);
        }
      } catch {
        if (!cancelled) {
          setRecipientOptions([]);
          if (!toInitialized) {
            setTo(defaultTo.filter(Boolean));
            setToInitialized(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    recordId,
    recordType,
    primaryContactId,
    defaultTo,
    toInitialized,
  ]);

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === accountId) ?? null,
    [accounts, accountId],
  );

  const fromSelectWidthCh = useMemo(() => {
    const label = selectedAccount
      ? `${selectedAccount.email}${selectedAccount.syncStatus !== "ACTIVE" ? " (sync inactive)" : ""}`
      : "Select account";
    return Math.min(Math.max(label.length + 3, 18), 56);
  }, [selectedAccount]);

  const availableRecipientOptions = useMemo(
    () => recipientOptions.filter((option) => !to.includes(option.email)),
    [recipientOptions, to],
  );

  const fieldOptions = useMemo(
    () =>
      [
        { key: "firstName", label: "First name", value: mergeFields.firstName },
        { key: "lastName", label: "Last name", value: mergeFields.lastName },
        { key: "fullName", label: "Full name", value: mergeFields.fullName },
        { key: "email", label: "Email", value: mergeFields.email },
        { key: "companyName", label: "Company", value: mergeFields.companyName },
        { key: "title", label: "Title", value: mergeFields.title },
      ].filter((item) => item.value),
    [mergeFields],
  );

  const commitRecipients = useCallback(
    (kind: "to" | "cc" | "bcc") => {
      if (kind === "to") {
        const next = parseEmails(toInput);
        if (next.length) {
          setTo((current) => Array.from(new Set([...current, ...next])));
        }
        setToInput("");
      } else if (kind === "cc") {
        const next = parseEmails(ccInput);
        if (next.length) {
          setCc((current) => Array.from(new Set([...current, ...next])));
        }
        setCcInput("");
      } else {
        const next = parseEmails(bccInput);
        if (next.length) {
          setBcc((current) => Array.from(new Set([...current, ...next])));
        }
        setBccInput("");
      }
    },
    [toInput, ccInput, bccInput],
  );

  const insertHtml = useCallback(
    (html: string) => {
      if (!editor) {
        return;
      }
      editor.chain().focus().insertContent(html).run();
    },
    [editor],
  );

  const insertField = (value: string) => {
    insertHtml(value);
  };

  const insertSavedSignature = (signature: CrmEmailSignatureDto) => {
    insertHtml(signature.bodyHtml || "<p></p>");
    setSignatureMenuOpen(false);
  };

  const insertSignature = () => {
    if (signatures.length === 1) {
      insertSavedSignature(signatures[0]!);
      return;
    }
    if (signatures.length > 1) {
      setSignatureMenuOpen((value) => !value);
      return;
    }
    const name = selectedAccount?.senderName || selectedAccount?.email || "SendDox";
    insertHtml(`<p>—<br/>${name}${selectedAccount?.email ? `<br/>${selectedAccount.email}` : ""}</p>`);
  };

  const insertMeeting = (kind: string) => {
    const label =
      kind === "15"
        ? "Book a 15-minute meeting"
        : kind === "30"
          ? "Book a 30-minute meeting"
          : "View my availability";
    insertHtml(
      `<p><a href="/app/contacts/calendar">${label}</a></p>`,
    );
  };

  const applyTemplate = (template: CrmEmailTemplateDto) => {
    const mergedSubject = applyEmailTemplateMergeFields(template.subject, {
      ...mergeFields,
      senderName: selectedAccount?.senderName ?? selectedAccount?.email,
    });
    const mergedBody = applyEmailTemplateMergeFields(template.bodyHtml, {
      ...mergeFields,
      senderName: selectedAccount?.senderName ?? selectedAccount?.email,
    });
    if (!subject.trim()) {
      setSubject(mergedSubject);
    } else if (template.subject.trim()) {
      setSubject(mergedSubject);
    }
    editor?.commands.setContent(mergedBody || "<p></p>");
    setBodyHtml(mergedBody || "<p></p>");
  };

  const resetComposer = () => {
    setSubject("");
    setBodyHtml("<p></p>");
    editor?.commands.setContent("<p></p>");
    setAttachments([]);
    setCc([]);
    setBcc([]);
    setError(null);
    setScheduleOpen(false);
    setScheduleAt("");
  };

  const submit = async (mode: "send" | "draft" | "schedule") => {
    setError(null);
    setStatus(null);
    commitRecipients("to");
    commitRecipients("cc");
    commitRecipients("bcc");
    const recipients = Array.from(new Set([...to, ...parseEmails(toInput)]));
    if (!accountId) {
      setError("Connect an email account under Email Sync first.");
      return;
    }
    if (mode !== "draft" && recipients.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    if (mode === "schedule" && !scheduleAt) {
      setError("Pick a schedule date and time.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/crm/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          accountId,
          to: recipients,
          cc,
          bcc,
          subject,
          bodyHtml: editor?.getHTML() ?? bodyHtml,
          contactId: recordType === "contact" ? recordId : undefined,
          leadId: recordType === "lead" ? recordId : undefined,
          companyId: recordType === "company" ? recordId : undefined,
          scheduleAt: mode === "schedule" ? scheduleAt : undefined,
          trackOpens,
          trackClicks,
          privateSend,
          attachments: attachments.map(({ filename, contentType, contentBase64 }) => ({
            filename,
            contentType,
            contentBase64,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not send email.");
      }
      if (mode === "draft") {
        setStatus("Draft saved to Drafts.");
      } else if (mode === "schedule") {
        setStatus("Email scheduled in Outbox.");
        resetComposer();
      } else {
        setStatus(
          selectedAccount?.provider === "GOOGLE" && selectedAccount.syncStatus === "ACTIVE"
            ? "Email sent."
            : "Email queued in Outbox / Sent.",
        );
        resetComposer();
        onSent?.();
      }
      setSendMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setBusy(false);
    }
  };

  const onPickAttachment = (fileList: FileList | null) => {
    if (!fileList?.length) {
      return;
    }
    Array.from(fileList).forEach((file) => {
      if (file.size > 8 * 1024 * 1024) {
        setError(`Attachment ${file.name} is larger than 8MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",")[1]! : result;
        setAttachments((current) => [
          ...current,
          {
            id: `${file.name}-${file.size}-${Date.now()}`,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            contentBase64: base64,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  if (accounts.length === 0) {
    return (
      <div className={cn("space-y-3 rounded-md border border-border bg-slate-50 px-4 py-5 text-center", className)}>
        <p className="text-sm text-muted">Connect an email account to compose from this record.</p>
        <LinkNext
          href="/app/settings/integrations/email"
          className="inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Open Email Sync
        </LinkNext>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-white", className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className={FIELD_LABEL_CLASS}>From</span>
        <QuietSelect
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          widthCh={fromSelectWidthCh}
          aria-label="From email account"
          tightChevron
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email}
              {account.syncStatus !== "ACTIVE" ? " (sync inactive)" : ""}
            </option>
          ))}
        </QuietSelect>
      </div>

      <EmailChipRow
        label="To"
        emails={to}
        onChange={setTo}
        inputValue={toInput}
        onInputChange={setToInput}
        onSubmitInput={() => commitRecipients("to")}
        trailing={
          <div className="flex shrink-0 items-center gap-1">
            {availableRecipientOptions.length > 0 ? (
              <QuietSelect
                defaultValue=""
                aria-label="Add company contact email"
                onChange={(event) => {
                  const email = event.target.value;
                  event.target.value = "";
                  if (!email) {
                    return;
                  }
                  setTo((current) => (current.includes(email) ? current : [...current, email]));
                }}
              >
                <option value="">Add contact…</option>
                {availableRecipientOptions.map((option) => (
                  <option key={option.id} value={option.email}>
                    {option.name}
                    {option.isPrimary ? " (primary)" : ""} — {option.email}
                  </option>
                ))}
              </QuietSelect>
            ) : null}
            <button
              type="button"
              title={showCcBcc ? "Hide Cc/Bcc" : "Show Cc/Bcc"}
              onClick={() => setShowCcBcc((value) => !value)}
              className="rounded px-1.5 py-1 text-xs text-muted hover:bg-slate-50 hover:text-foreground"
            >
              ↕
            </button>
          </div>
        }
      />
      {showCcBcc ? (
        <>
          <EmailChipRow
            label="Cc"
            emails={cc}
            onChange={setCc}
            inputValue={ccInput}
            onInputChange={setCcInput}
            onSubmitInput={() => commitRecipients("cc")}
          />
          <EmailChipRow
            label="Bcc"
            emails={bcc}
            onChange={setBcc}
            inputValue={bccInput}
            onInputChange={setBccInput}
            onSubmitInput={() => commitRecipients("bcc")}
          />
        </>
      ) : null}

      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <span className="w-16 shrink-0 text-sm text-muted">Subject</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <CrmEmailTemplatePicker
          templates={templates}
          onSelect={applyTemplate}
          onSaveDraftAsTemplate={() =>
            setTemplateModal({
              open: true,
              mode: "create",
              template: null,
              fromDraft: true,
            })
          }
          onManageTemplates={() => setManageTemplatesOpen(true)}
        />

        <QuietSelect
          defaultValue=""
          aria-label="Insert field"
          onChange={(event) => {
            if (event.target.value) {
              insertField(event.target.value);
              event.target.value = "";
            }
          }}
        >
          <option value="">Insert field</option>
          {fieldOptions.length === 0 ? (
            <option value="" disabled>
              No fields available
            </option>
          ) : (
            fieldOptions.map((field) => (
              <option key={field.key} value={field.value}>
                {field.label}
              </option>
            ))
          )}
        </QuietSelect>

        <QuietSelect
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
        </QuietSelect>
      </div>

      <EditorContent editor={editor} />
      {editor ? <CrmEmailComposerToolbar editor={editor} /> : null}

      {attachments.length ? (
        <ul className="space-y-1 border-t border-border px-3 py-2">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="truncate">
                {file.filename} ({Math.round(file.size / 1024)} KB)
              </span>
              <button
                type="button"
                className="text-red-600 hover:underline"
                onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {scheduleOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-slate-50 px-3 py-2">
          <label className="text-xs font-medium text-muted">Send at</label>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
            className="rounded-md border border-border bg-white px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit("schedule")}
            className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Confirm schedule
          </button>
        </div>
      ) : null}

      {error ? <p className="border-t border-border px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {status ? <p className="border-t border-border px-3 py-2 text-sm text-emerald-700">{status}</p> : null}

      <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-2">
        <ToolbarButton title="Attach files" onClick={() => attachRef.current?.click()}>
          📎
        </ToolbarButton>
        <div ref={signatureMenuRef} className="relative">
          <ToolbarButton title="Insert signature" onClick={insertSignature}>
            ✎
          </ToolbarButton>
          {signatureMenuOpen && signatures.length > 1 ? (
            <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[12rem] overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg">
              {signatures.map((signature) => (
                <button
                  key={signature.id}
                  type="button"
                  onClick={() => insertSavedSignature(signature)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-slate-50"
                >
                  {signature.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <ToolbarButton
          title="Track email opens"
          active={trackOpens}
          onClick={() => setTrackOpens((value) => !value)}
          className={trackOpens ? "text-primary" : undefined}
        >
          👁
        </ToolbarButton>
        <ToolbarButton
          title="Track link clicks"
          active={trackClicks}
          onClick={() => setTrackClicks((value) => !value)}
          className={trackClicks ? "text-primary" : undefined}
        >
          ↖
        </ToolbarButton>
        <ToolbarButton title="Schedule send" active={scheduleOpen} onClick={() => setScheduleOpen((value) => !value)}>
          📅
        </ToolbarButton>
        <ToolbarButton
          title="Private email"
          active={privateSend}
          onClick={() => setPrivateSend((value) => !value)}
        >
          🔒
        </ToolbarButton>
        <ToolbarButton title="Discard draft" onClick={resetComposer}>
          🗑
        </ToolbarButton>

        <div className="relative ml-auto flex items-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit("send")}
            className="rounded-l-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSendMenuOpen((value) => !value)}
            className="rounded-r-md border-l border-primary-foreground/20 bg-primary px-2 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            aria-label="More send options"
          >
            ▾
          </button>
          {sendMenuOpen ? (
            <div className="absolute bottom-full right-0 z-10 mb-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-white shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void submit("send")}
              >
                Send now
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setScheduleOpen(true);
                  setSendMenuOpen(false);
                }}
              >
                Schedule send
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void submit("draft")}
              >
                Save draft
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={attachRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          onPickAttachment(event.target.files);
          event.target.value = "";
        }}
      />

      <CrmEmailTemplateManageModal
        open={manageTemplatesOpen}
        templates={templates}
        onClose={() => setManageTemplatesOpen(false)}
        onAddNew={() =>
          setTemplateModal({
            open: true,
            mode: "create",
            template: null,
            fromDraft: false,
          })
        }
        onEdit={(template) =>
          setTemplateModal({
            open: true,
            mode: "edit",
            template,
            fromDraft: false,
          })
        }
        onDeleted={(templateId) => {
          setTemplates((current) => current.filter((item) => item.id !== templateId));
        }}
      />

      <CrmEmailTemplateModal
        open={templateModal.open}
        mode={templateModal.mode}
        template={templateModal.template}
        templates={templates}
        initialName={
          templateModal.fromDraft
            ? subject.trim() || "Untitled template"
            : templateModal.template?.name || "Untitled template"
        }
        initialSubject={
          templateModal.fromDraft
            ? subject
            : templateModal.template?.subject || ""
        }
        initialBodyHtml={
          templateModal.fromDraft
            ? editor?.getHTML() ?? bodyHtml
            : templateModal.template?.bodyHtml || "<p></p>"
        }
        onClose={() => setTemplateModal((current) => ({ ...current, open: false }))}
        onSaved={(saved) => {
          setTemplates((current) => {
            const without = current.filter((item) => item.id !== saved.id);
            return [saved, ...without];
          });
        }}
        onDeleted={(templateId) => {
          setTemplates((current) => current.filter((item) => item.id !== templateId));
        }}
      />
    </div>
  );
}
