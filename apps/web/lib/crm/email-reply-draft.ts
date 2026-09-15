export const CRM_EMAIL_REPLY_DRAFT_KEY = "crm-email-reply-draft";

export type CrmEmailReplyDraft = {
  to: string[];
  subject: string;
  bodyHtml: string;
  messageId?: string;
};

export function writeEmailReplyDraft(draft: CrmEmailReplyDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(CRM_EMAIL_REPLY_DRAFT_KEY, JSON.stringify(draft));
}

export function readEmailReplyDraft(): CrmEmailReplyDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(CRM_EMAIL_REPLY_DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CrmEmailReplyDraft;
    if (!parsed || !Array.isArray(parsed.to) || typeof parsed.subject !== "string") {
      return null;
    }
    return {
      to: parsed.to.filter((item): item is string => typeof item === "string"),
      subject: parsed.subject,
      bodyHtml: typeof parsed.bodyHtml === "string" ? parsed.bodyHtml : "<p></p>",
      messageId: typeof parsed.messageId === "string" ? parsed.messageId : undefined,
    };
  } catch {
    return null;
  }
}

export function clearEmailReplyDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(CRM_EMAIL_REPLY_DRAFT_KEY);
}

export function buildReplySubject(subject: string): string {
  const trimmed = subject.trim() || "(No subject)";
  return /^re:\s/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function buildQuotedReplyHtml(input: {
  fromName: string;
  fromAddress: string;
  messageAt: string;
  bodyHtml: string | null;
  bodyText: string | null;
}): string {
  const when = new Date(input.messageAt);
  const whenLabel = Number.isNaN(when.getTime())
    ? input.messageAt
    : when.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  const sender = input.fromName ? `${input.fromName} &lt;${input.fromAddress}&gt;` : input.fromAddress;
  const body =
    input.bodyHtml?.trim() ||
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.bodyText ?? "")}</pre>`;
  return `<p></p><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:4px;color:#555"><p>On ${whenLabel}, ${sender} wrote:</p>${body}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
