export function supportUnreadNotificationEmail(input: {
  customerName: string;
  subject: string;
  preview: string;
  appUrl: string;
  replyTo: string;
}): { subject: string; html: string; text: string; replyTo: string } {
  const subject = `Re: ${input.subject}`;
  const preview = input.preview.slice(0, 280);
  const text = [
    `Hi ${input.customerName},`,
    "",
    "SendDox Support replied to your message:",
    "",
    preview,
    "",
    `Open the conversation: ${input.appUrl}/app`,
    "",
    "You can reply to this email to continue the conversation.",
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
<p>Hi ${escapeHtml(input.customerName)},</p>
<p>SendDox Support replied to your message:</p>
<blockquote style="border-left:3px solid #1e3a5f;padding-left:12px;margin:12px 0;color:#334155">${escapeHtml(preview)}</blockquote>
<p><a href="${escapeHtml(input.appUrl)}/app">Open SendDox</a></p>
<p style="color:#64748b;font-size:13px">Reply to this email to continue the conversation.</p>
</body></html>`;

  return { subject, html, text, replyTo: input.replyTo };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
