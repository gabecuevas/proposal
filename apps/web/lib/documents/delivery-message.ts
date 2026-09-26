/** Variable that expands to the document's view-only public URL. */
export const DOCUMENT_LINK_TOKEN = "[Document.Link]";

const LEGACY_TOKENS: Record<string, string> = {
  recipient_full_name: "Recipient.FullName",
  recipient_first_name: "Recipient.FirstName",
  recipient_email: "Recipient.Email",
  sender_full_name: "Sender.FullName",
  sender_company_name: "Sender.CompanyName",
  document_link: "Document.Link",
};

function readPath(context: Record<string, unknown>, path: string): string {
  if (typeof context[path] === "string" || typeof context[path] === "number") {
    return String(context[path]);
  }
  let current: unknown = context;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" || typeof current === "number" ? String(current) : "";
}

/**
 * Replace `[Group.Key]` tokens (and legacy `{{snake_case}}` ones) with values.
 * Unknown tokens resolve to an empty string so recipients never see raw brackets.
 */
export function renderDeliveryText(text: string, context: Record<string, unknown>): string {
  return text
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
      const path = LEGACY_TOKENS[key.toLowerCase()];
      return path ? readPath(context, path) : "";
    })
    .replace(/\[([A-Za-z][\w]*(?:\.[\w]+)+)\]/g, (_match, path: string) => readPath(context, path));
}

export type DeliveryRecipient = { name: string; email: string };

export function deliveryContext(input: {
  variables: Record<string, unknown>;
  recipient: DeliveryRecipient;
  link: string;
  title: string;
}): Record<string, unknown> {
  const recipientVars = (input.variables.Recipient as Record<string, unknown> | undefined) ?? {};
  const name = input.recipient.name.trim();
  return {
    ...input.variables,
    Recipient: {
      ...recipientVars,
      FullName: name || recipientVars.FullName,
      FirstName: name.split(/\s+/)[0] || recipientVars.FirstName,
      Email: input.recipient.email,
    },
    Document: { Link: input.link, Title: input.title },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Recipient email for a delivered document; the link is always included. */
export function documentDeliveryEmail(input: {
  subject: string;
  message: string;
  context: Record<string, unknown>;
  link: string;
  noun: string;
}): { subject: string; text: string; html: string } {
  const subject = renderDeliveryText(input.subject, input.context).trim() || `New ${input.noun.toLowerCase()}`;
  const includesLink = /\[Document\.Link\]|\{\{\s*document_link\s*\}\}/i.test(input.message);
  const message = renderDeliveryText(input.message, input.context);
  const text = includesLink ? message : `${message}\n\n${input.link}`;

  const linkHtml = `<a href="${escapeHtml(input.link)}">${escapeHtml(input.link)}</a>`;
  const bodyHtml = escapeHtml(message)
    .split(escapeHtml(input.link))
    .join(linkHtml)
    .replaceAll("\n", "<br>");
  const button = `<p><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View ${escapeHtml(input.noun)}</a></p>`;
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">
  <p>${bodyHtml}</p>
  ${button}
</body></html>`;
  return { subject, text, html };
}
