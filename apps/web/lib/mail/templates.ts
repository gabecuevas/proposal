function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function verificationEmail(params: {
  name: string;
  verifyUrl: string;
}) {
  const name = escapeHtml(params.name);
  const url = escapeHtml(params.verifyUrl);
  const subject = "Verify your SendDox email";
  const text = [
    `Hi ${params.name},`,
    "",
    "Verify your email to continue setting up SendDox.",
    "",
    `Verify email: ${params.verifyUrl}`,
    "",
    "This link expires in 24 hours.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">
  <p>Hi ${name},</p>
  <p>Verify your email to continue setting up SendDox.</p>
  <p><a href="${url}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify email</a></p>
  <p style="color:#64748b;font-size:14px">Or paste this link into your browser:<br>${url}</p>
  <p style="color:#64748b;font-size:14px">This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
</body></html>`;
  return { subject, html, text };
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
}) {
  const name = escapeHtml(params.name);
  const url = escapeHtml(params.resetUrl);
  const subject = "Reset your SendDox password";
  const text = [
    `Hi ${params.name},`,
    "",
    "Use the link below to reset your password. It expires in 30 minutes.",
    "",
    params.resetUrl,
    "",
    "If you did not request a reset, you can ignore this email.",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">
  <p>Hi ${name},</p>
  <p>Use the button below to reset your password. This link expires in 30 minutes.</p>
  <p><a href="${url}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset password</a></p>
  <p style="color:#64748b;font-size:14px">Or paste this link into your browser:<br>${url}</p>
</body></html>`;
  return { subject, html, text };
}

export function invitationEmail(params: {
  inviterName: string;
  companyName: string;
  inviteUrl: string;
}) {
  const inviter = escapeHtml(params.inviterName);
  const company = escapeHtml(params.companyName);
  const url = escapeHtml(params.inviteUrl);
  const subject = `Join ${params.companyName} on SendDox`;
  const text = [
    `${params.inviterName} invited you to join ${params.companyName} on SendDox.`,
    "",
    `Accept invitation: ${params.inviteUrl}`,
    "",
    "This invitation expires in 7 days.",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">
  <p><strong>${inviter}</strong> invited you to join <strong>${company}</strong> on SendDox.</p>
  <p><a href="${url}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Accept invitation</a></p>
  <p style="color:#64748b;font-size:14px">This invitation expires in 7 days.</p>
</body></html>`;
  return { subject, html, text };
}
