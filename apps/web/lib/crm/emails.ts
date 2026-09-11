import { prisma, type CrmEmailFolder, type CrmEmailSyncProvider } from "@repo/db";

export const EMAIL_FOLDER_IDS = ["inbox", "drafts", "outbox", "sent", "trash"] as const;
export type EmailFolderId = (typeof EMAIL_FOLDER_IDS)[number];

export const EMAIL_SYNC_PROVIDERS = ["GOOGLE", "OFFICE365", "EXCHANGE", "IMAP"] as const;
export type EmailSyncProviderId = (typeof EMAIL_SYNC_PROVIDERS)[number];

export const PERSONAL_EMAIL_ACCOUNT_LIMIT = 3;

const FOLDER_TO_DB: Record<EmailFolderId, CrmEmailFolder> = {
  inbox: "INBOX",
  drafts: "DRAFTS",
  outbox: "OUTBOX",
  sent: "SENT",
  trash: "TRASH",
};

const FOLDER_FROM_DB: Record<CrmEmailFolder, EmailFolderId> = {
  INBOX: "inbox",
  DRAFTS: "drafts",
  OUTBOX: "outbox",
  SENT: "sent",
  TRASH: "trash",
};

export type CrmEmailListItem = {
  id: string;
  folder: EmailFolderId;
  direction: "INBOUND" | "OUTBOUND";
  fromName: string;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  snippet: string;
  bodyHtml: string | null;
  bodyText: string | null;
  isRead: boolean;
  hasAttachments: boolean;
  messageAt: string;
  pinnedAt: string | null;
};

function asAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeEmailMessage(row: {
  id: string;
  folder: CrmEmailFolder;
  direction: "INBOUND" | "OUTBOUND";
  from_name: string | null;
  from_address: string;
  to_addresses: unknown;
  subject: string;
  snippet: string;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  has_attachments: boolean;
  message_at: Date;
  pinned_at?: Date | null;
}): CrmEmailListItem {
  return {
    id: row.id,
    folder: FOLDER_FROM_DB[row.folder],
    direction: row.direction,
    fromName: row.from_name ?? "",
    fromAddress: row.from_address,
    toAddresses: asAddressList(row.to_addresses),
    subject: row.subject,
    snippet: row.snippet,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    isRead: row.is_read,
    hasAttachments: row.has_attachments,
    messageAt: row.message_at.toISOString(),
    pinnedAt: row.pinned_at?.toISOString() ?? null,
  };
}

export type CrmEmailAccountDto = {
  id: string;
  email: string;
  senderName: string | null;
  provider: EmailSyncProviderId;
  isDefault: boolean;
  syncStatus: "INACTIVE" | "ACTIVE" | "ERROR";
  lastSyncedAt: string | null;
  credentialsConfigured: boolean;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
};

export function parseEmailFolder(folderParam: string | null): EmailFolderId {
  if (folderParam && (EMAIL_FOLDER_IDS as readonly string[]).includes(folderParam)) {
    return folderParam as EmailFolderId;
  }
  return "inbox";
}

export function parseEmailSyncProvider(value: unknown): EmailSyncProviderId | null {
  if (typeof value !== "string") {
    return null;
  }
  return (EMAIL_SYNC_PROVIDERS as readonly string[]).includes(value)
    ? (value as EmailSyncProviderId)
    : null;
}

export function toDbEmailFolder(folder: EmailFolderId): CrmEmailFolder {
  return FOLDER_TO_DB[folder];
}

export function serializeEmailAccount(account: {
  id: string;
  email: string;
  sender_name: string | null;
  provider: CrmEmailSyncProvider;
  is_default: boolean;
  sync_status: "INACTIVE" | "ACTIVE" | "ERROR";
  last_synced_at: Date | null;
  credentials_configured: boolean;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
}): CrmEmailAccountDto {
  return {
    id: account.id,
    email: account.email,
    senderName: account.sender_name,
    provider: account.provider,
    isDefault: account.is_default,
    syncStatus: account.sync_status,
    lastSyncedAt: account.last_synced_at?.toISOString() ?? null,
    credentialsConfigured: account.credentials_configured,
    imapHost: account.imap_host,
    imapPort: account.imap_port,
    smtpHost: account.smtp_host,
    smtpPort: account.smtp_port,
  };
}

export async function listCrmEmails(
  workspaceId: string,
  folder: EmailFolderId,
  limit = 100,
): Promise<CrmEmailListItem[]> {
  const rows = await prisma.crmEmailMessage.findMany({
    where: {
      workspace_id: workspaceId,
      folder: toDbEmailFolder(folder),
    },
    orderBy: { message_at: "desc" },
    take: limit,
  });

  return rows.map((row) => serializeEmailMessage(row));
}

export async function countUnreadInbox(workspaceId: string): Promise<number> {
  try {
    return await prisma.crmEmailMessage.count({
      where: {
        workspace_id: workspaceId,
        folder: "INBOX",
        is_read: false,
      },
    });
  } catch {
    // Avoid breaking Contacts sidebar counts if the email schema client is stale.
    return 0;
  }
}

export async function listEmailAccounts(workspaceId: string) {
  if (!prisma.crmEmailAccount) {
    throw new Error("Email sync storage is restarting. Refresh the page and try again.");
  }
  return prisma.crmEmailAccount.findMany({
    where: { workspace_id: workspaceId },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
  });
}

export async function countEmailAccounts(workspaceId: string): Promise<number> {
  if (!prisma.crmEmailAccount) {
    throw new Error("Email sync storage is restarting. Refresh the page and try again.");
  }
  return prisma.crmEmailAccount.count({ where: { workspace_id: workspaceId } });
}

export type CreateEmailAccountInput = {
  email: string;
  provider: EmailSyncProviderId;
  userId?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  credentialsConfigured?: boolean;
};

export async function createEmailAccount(workspaceId: string, input: CreateEmailAccountInput) {
  const existingCount = await countEmailAccounts(workspaceId);
  if (existingCount >= PERSONAL_EMAIL_ACCOUNT_LIMIT) {
    throw new Error(`Personal email account limit reached (${PERSONAL_EMAIL_ACCOUNT_LIMIT}).`);
  }

  const email = input.email.trim().toLowerCase();
  const duplicate = await prisma.crmEmailAccount.findUnique({
    where: {
      workspace_id_email: {
        workspace_id: workspaceId,
        email,
      },
    },
  });
  if (duplicate) {
    throw new Error("That email account is already connected.");
  }

  return prisma.crmEmailAccount.create({
    data: {
      workspace_id: workspaceId,
      user_id: input.userId ?? null,
      email,
      provider: input.provider,
      is_default: existingCount === 0,
      sync_status: "INACTIVE",
      imap_host: input.imapHost ?? null,
      imap_port: input.imapPort ?? null,
      smtp_host: input.smtpHost ?? null,
      smtp_port: input.smtpPort ?? null,
      credentials_configured: Boolean(input.credentialsConfigured),
    },
  });
}

export type ActivateGoogleEmailAccountInput = {
  email: string;
  userId: string;
  senderName?: string | null;
  accountId?: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
  scope: string | null;
};

/** Create or update a Google mailbox after a successful OAuth consent. */
export async function activateGoogleEmailAccount(
  workspaceId: string,
  input: ActivateGoogleEmailAccountInput,
) {
  if (!prisma.crmEmailAccount) {
    throw new Error("Email sync storage is restarting. Refresh the page and try again.");
  }

  const email = input.email.trim().toLowerCase();
  const existing = input.accountId
    ? await prisma.crmEmailAccount.findFirst({
        where: { id: input.accountId, workspace_id: workspaceId },
      })
    : await prisma.crmEmailAccount.findUnique({
        where: {
          workspace_id_email: {
            workspace_id: workspaceId,
            email,
          },
        },
      });

  if (existing && existing.provider !== "GOOGLE") {
    throw new Error("That address is already connected with a different provider.");
  }

  if (existing) {
    return prisma.crmEmailAccount.update({
      where: { id: existing.id },
      data: {
        email,
        user_id: input.userId,
        sender_name: input.senderName ?? existing.sender_name,
        provider: "GOOGLE",
        sync_status: "ACTIVE",
        credentials_configured: true,
        oauth_access_token: input.accessTokenEncrypted,
        oauth_refresh_token: input.refreshTokenEncrypted ?? existing.oauth_refresh_token,
        oauth_expires_at: input.expiresAt,
        oauth_scope: input.scope,
        last_synced_at: new Date(),
      },
    });
  }

  const existingCount = await countEmailAccounts(workspaceId);
  if (existingCount >= PERSONAL_EMAIL_ACCOUNT_LIMIT) {
    throw new Error(`Personal email account limit reached (${PERSONAL_EMAIL_ACCOUNT_LIMIT}).`);
  }

  return prisma.crmEmailAccount.create({
    data: {
      workspace_id: workspaceId,
      user_id: input.userId,
      email,
      sender_name: input.senderName ?? null,
      provider: "GOOGLE",
      is_default: existingCount === 0,
      sync_status: "ACTIVE",
      credentials_configured: true,
      oauth_access_token: input.accessTokenEncrypted,
      oauth_refresh_token: input.refreshTokenEncrypted,
      oauth_expires_at: input.expiresAt,
      oauth_scope: input.scope,
      last_synced_at: new Date(),
    },
  });
}

/** Remove an email account and clear OAuth credentials from this workspace. */
export async function disconnectEmailAccount(workspaceId: string, accountId: string) {
  if (!prisma.crmEmailAccount) {
    throw new Error("Email sync storage is restarting. Refresh the page and try again.");
  }

  const account = await prisma.crmEmailAccount.findFirst({
    where: { id: accountId, workspace_id: workspaceId },
  });
  if (!account) {
    throw new Error("Email account not found.");
  }

  await prisma.crmEmailAccount.delete({ where: { id: account.id } });

  if (account.is_default) {
    const nextDefault = await prisma.crmEmailAccount.findFirst({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "asc" },
    });
    if (nextDefault) {
      await prisma.crmEmailAccount.update({
        where: { id: nextDefault.id },
        data: { is_default: true },
      });
    }
  }

  return { id: account.id, email: account.email };
}

export async function updateEmailAccount(
  workspaceId: string,
  accountId: string,
  input: { senderName?: string | null; isDefault?: boolean },
) {
  if (!prisma.crmEmailAccount) {
    throw new Error("Email sync storage is restarting. Refresh the page and try again.");
  }
  const account = await prisma.crmEmailAccount.findFirst({
    where: { id: accountId, workspace_id: workspaceId },
  });
  if (!account) {
    throw new Error("Email account not found.");
  }

  if (input.isDefault === true) {
    await prisma.crmEmailAccount.updateMany({
      where: { workspace_id: workspaceId, NOT: { id: account.id } },
      data: { is_default: false },
    });
  }

  return prisma.crmEmailAccount.update({
    where: { id: account.id },
    data: {
      ...(input.senderName !== undefined
        ? { sender_name: input.senderName?.trim() || null }
        : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
    },
  });
}

export const EMAIL_SYNC_LOOKBACK_OPTIONS = [
  { id: "3days", label: "3 days ago" },
  { id: "1month", label: "1 month ago" },
  { id: "3months", label: "3 months ago" },
  { id: "6months", label: "6 months ago" },
  { id: "1year", label: "1 year ago" },
  { id: "2years", label: "2 years ago" },
] as const;

export type EmailSyncLookbackId = (typeof EMAIL_SYNC_LOOKBACK_OPTIONS)[number]["id"];

export function parseEmailSyncLookback(value: unknown): EmailSyncLookbackId {
  if (typeof value === "string" && EMAIL_SYNC_LOOKBACK_OPTIONS.some((option) => option.id === value)) {
    return value as EmailSyncLookbackId;
  }
  return "3days";
}

export function syncLookbackStartDate(lookback: EmailSyncLookbackId, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (lookback) {
    case "3days":
      start.setDate(start.getDate() - 3);
      break;
    case "1month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3months":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6months":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1year":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "2years":
      start.setFullYear(start.getFullYear() - 2);
      break;
    default:
      start.setDate(start.getDate() - 3);
  }
  return start;
}

export function formatSyncLookbackOption(lookback: EmailSyncLookbackId, now = new Date()): string {
  const option = EMAIL_SYNC_LOOKBACK_OPTIONS.find((item) => item.id === lookback) ?? EMAIL_SYNC_LOOKBACK_OPTIONS[0];
  const date = syncLookbackStartDate(lookback, now);
  const formatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${option.label} (${formatted})`;
}

async function resolveRecordLinksForAddresses(
  workspaceId: string,
  addresses: string[],
): Promise<{ contactId: string | null; leadId: string | null; companyId: string | null }> {
  const unique = Array.from(new Set(addresses.map((item) => item.trim().toLowerCase()).filter(Boolean)));
  if (unique.length === 0) {
    return { contactId: null, leadId: null, companyId: null };
  }

  const contact = await prisma.contact.findFirst({
    where: {
      workspace_id: workspaceId,
      OR: unique.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
    },
    select: { id: true, company_id: true },
  });
  if (contact) {
    return { contactId: contact.id, leadId: null, companyId: contact.company_id ?? null };
  }

  const lead = await prisma.lead.findFirst({
    where: {
      workspace_id: workspaceId,
      OR: unique.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
    },
    select: { id: true, company_id: true, person_id: true },
  });
  if (lead) {
    return {
      contactId: lead.person_id ?? null,
      leadId: lead.id,
      companyId: lead.company_id ?? null,
    };
  }

  return { contactId: null, leadId: null, companyId: null };
}

export async function syncPastEmailsForAccount(
  workspaceId: string,
  accountId: string,
  lookback: EmailSyncLookbackId,
): Promise<{ imported: number; scanned: number; syncFromAt: string }> {
  if (!prisma.crmEmailAccount || !prisma.crmEmailMessage) {
    throw new Error("Email storage is restarting. Refresh and try again.");
  }

  const account = await prisma.crmEmailAccount.findFirst({
    where: { id: accountId, workspace_id: workspaceId },
  });
  if (!account) {
    throw new Error("Email account not found.");
  }
  if (account.provider !== "GOOGLE") {
    throw new Error("Past email sync is currently available for Google accounts.");
  }
  if (account.sync_status !== "ACTIVE") {
    throw new Error("Connect this Google mailbox before syncing past emails.");
  }

  const accessToken = await resolveGoogleAccessToken(account);
  const { listGmailMessageIds, fetchGmailMessage } = await import("@/lib/crm/google-email-oauth");
  const syncFromAt = syncLookbackStartDate(lookback);
  const messageIds = await listGmailMessageIds({ accessToken, after: syncFromAt, maxResults: 150 });

  let imported = 0;
  const accountEmail = account.email.toLowerCase();

  for (const messageId of messageIds) {
    const message = await fetchGmailMessage(accessToken, messageId);
    if (!message) {
      continue;
    }

    const isOutbound =
      message.fromAddress === accountEmail ||
      message.labelIds.includes("SENT") ||
      message.labelIds.includes("DRAFT");
    const folder = message.labelIds.includes("DRAFT")
      ? "DRAFTS"
      : message.labelIds.includes("TRASH")
        ? "TRASH"
        : isOutbound
          ? "SENT"
          : "INBOX";
    const direction = isOutbound ? "OUTBOUND" : "INBOUND";
    const linkAddresses = isOutbound
      ? [...message.toAddresses, ...message.ccAddresses]
      : [message.fromAddress, ...message.toAddresses];
    const links = await resolveRecordLinksForAddresses(workspaceId, linkAddresses);

    await prisma.crmEmailMessage.upsert({
      where: {
        workspace_id_external_id: {
          workspace_id: workspaceId,
          external_id: message.externalId,
        },
      },
      create: {
        workspace_id: workspaceId,
        account_id: account.id,
        folder,
        direction,
        from_name: message.fromName,
        from_address: message.fromAddress,
        to_addresses: message.toAddresses,
        cc_addresses: message.ccAddresses.length ? message.ccAddresses : undefined,
        subject: message.subject,
        snippet: message.snippet,
        body_text: message.bodyText,
        body_html: message.bodyHtml,
        is_read: true,
        has_attachments: message.hasAttachments,
        message_at: message.messageAt,
        external_id: message.externalId,
        contact_id: links.contactId,
        lead_id: links.leadId,
        company_id: links.companyId,
      },
      update: {
        folder,
        direction,
        from_name: message.fromName,
        from_address: message.fromAddress,
        to_addresses: message.toAddresses,
        cc_addresses: message.ccAddresses.length ? message.ccAddresses : undefined,
        subject: message.subject,
        snippet: message.snippet,
        body_text: message.bodyText,
        body_html: message.bodyHtml,
        has_attachments: message.hasAttachments,
        message_at: message.messageAt,
        contact_id: links.contactId,
        lead_id: links.leadId,
        company_id: links.companyId,
      },
    });
    imported += 1;
  }

  await prisma.crmEmailAccount.update({
    where: { id: account.id },
    data: {
      sync_from_at: syncFromAt,
      last_synced_at: new Date(),
      sync_status: "ACTIVE",
    },
  });

  return {
    imported,
    scanned: messageIds.length,
    syncFromAt: syncFromAt.toISOString(),
  };
}

function htmlToSnippet(html: string, max = 160): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type OutboundEmailMode = "send" | "draft" | "schedule";

export type OutboundEmailAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type CreateOutboundEmailInput = {
  accountId: string;
  mode: OutboundEmailMode;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  contactId?: string | null;
  leadId?: string | null;
  companyId?: string | null;
  scheduleAt?: string | null;
  trackOpens?: boolean;
  trackClicks?: boolean;
  privateSend?: boolean;
  attachments?: OutboundEmailAttachment[];
};

function trackingSnippetSuffix(input: {
  trackOpens?: boolean;
  trackClicks?: boolean;
  privateSend?: boolean;
}): string {
  const flags = [
    input.trackOpens ? "opens" : null,
    input.trackClicks ? "clicks" : null,
    input.privateSend ? "private" : null,
  ].filter(Boolean);
  return flags.length ? ` [${flags.join(",")}]` : "";
}

async function resolveGoogleAccessToken(account: {
  id: string;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: Date | null;
}) {
  const { decryptSecret, encryptSecret, refreshGoogleAccessToken } = await import(
    "@/lib/crm/google-email-oauth"
  );

  if (!account.oauth_access_token && !account.oauth_refresh_token) {
    throw new Error("This mailbox is not authorized. Connect with Google first.");
  }

  const expiresAt = account.oauth_expires_at?.getTime() ?? 0;
  const stillValid = account.oauth_access_token && expiresAt > Date.now() + 60_000;
  if (stillValid && account.oauth_access_token) {
    return decryptSecret(account.oauth_access_token);
  }

  if (!account.oauth_refresh_token) {
    throw new Error("Google access expired. Reconnect this mailbox under Email Sync.");
  }

  const refreshed = await refreshGoogleAccessToken(decryptSecret(account.oauth_refresh_token));
  await prisma.crmEmailAccount.update({
    where: { id: account.id },
    data: {
      oauth_access_token: encryptSecret(refreshed.accessToken),
      oauth_expires_at: refreshed.expiresAt,
      oauth_scope: refreshed.scope,
    },
  });
  return refreshed.accessToken;
}

export async function createOutboundEmail(workspaceId: string, input: CreateOutboundEmailInput) {
  if (!prisma.crmEmailAccount || !prisma.crmEmailMessage) {
    throw new Error("Email storage is restarting. Refresh and try again.");
  }

  const to = input.to.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (to.length === 0) {
    throw new Error("Add at least one recipient.");
  }

  const account = await prisma.crmEmailAccount.findFirst({
    where: { id: input.accountId, workspace_id: workspaceId },
  });
  if (!account) {
    throw new Error("Email account not found.");
  }

  const subject = input.subject.trim();
  const bodyHtml = input.bodyHtml.trim() || "<p></p>";
  const bodyText = htmlToPlainText(bodyHtml);
  const snippet = `${htmlToSnippet(bodyHtml)}${trackingSnippetSuffix(input)}`;
  const scheduleAt = input.scheduleAt ? new Date(input.scheduleAt) : null;
  if (input.mode === "schedule" && (!scheduleAt || Number.isNaN(scheduleAt.getTime()))) {
    throw new Error("Choose a valid schedule time.");
  }

  if (input.mode === "draft") {
    return prisma.crmEmailMessage.create({
      data: {
        workspace_id: workspaceId,
        account_id: account.id,
        folder: "DRAFTS",
        direction: "OUTBOUND",
        from_name: account.sender_name,
        from_address: account.email,
        to_addresses: to,
        cc_addresses: input.cc?.length ? input.cc : undefined,
        subject,
        snippet,
        body_text: bodyText,
        body_html: bodyHtml,
        is_read: true,
        has_attachments: Boolean(input.attachments?.length),
        message_at: new Date(),
        contact_id: input.contactId ?? null,
        lead_id: input.leadId ?? null,
        company_id: input.companyId ?? null,
      },
    });
  }

  if (input.mode === "schedule") {
    return prisma.crmEmailMessage.create({
      data: {
        workspace_id: workspaceId,
        account_id: account.id,
        folder: "OUTBOX",
        direction: "OUTBOUND",
        from_name: account.sender_name,
        from_address: account.email,
        to_addresses: to,
        cc_addresses: input.cc?.length ? input.cc : undefined,
        subject,
        snippet,
        body_text: bodyText,
        body_html: bodyHtml,
        is_read: true,
        has_attachments: Boolean(input.attachments?.length),
        message_at: scheduleAt!,
        contact_id: input.contactId ?? null,
        lead_id: input.leadId ?? null,
        company_id: input.companyId ?? null,
      },
    });
  }

  if (account.provider === "GOOGLE") {
    const { sendGmailRawMessage } = await import("@/lib/crm/google-email-oauth");
    const accessToken = await resolveGoogleAccessToken(account);
    const sent = await sendGmailRawMessage({
      accessToken,
      fromEmail: account.email,
      fromName: account.sender_name,
      to,
      cc: input.cc,
      bcc: input.bcc,
      subject,
      htmlBody: bodyHtml,
      textBody: bodyText,
      attachments: input.attachments,
    });

    return prisma.crmEmailMessage.create({
      data: {
        workspace_id: workspaceId,
        account_id: account.id,
        folder: "SENT",
        direction: "OUTBOUND",
        from_name: account.sender_name,
        from_address: account.email,
        to_addresses: to,
        cc_addresses: input.cc?.length ? input.cc : undefined,
        subject,
        snippet,
        body_text: bodyText,
        body_html: bodyHtml,
        is_read: true,
        has_attachments: Boolean(input.attachments?.length),
        message_at: new Date(),
        external_id: sent.id,
        contact_id: input.contactId ?? null,
        lead_id: input.leadId ?? null,
        company_id: input.companyId ?? null,
      },
    });
  }

  // Non-Google providers: queue in Outbox until SMTP sending is wired.
  return prisma.crmEmailMessage.create({
    data: {
      workspace_id: workspaceId,
      account_id: account.id,
      folder: "OUTBOX",
      direction: "OUTBOUND",
      from_name: account.sender_name,
      from_address: account.email,
      to_addresses: to,
      cc_addresses: input.cc?.length ? input.cc : undefined,
      subject,
      snippet,
      body_text: bodyText,
      body_html: bodyHtml,
      is_read: true,
      has_attachments: Boolean(input.attachments?.length),
      message_at: new Date(),
      contact_id: input.contactId ?? null,
      lead_id: input.leadId ?? null,
      company_id: input.companyId ?? null,
    },
  });
}

export async function listEmailsForRecord(
  workspaceId: string,
  links: { contactId?: string | null; leadId?: string | null; companyId?: string | null },
  limit = 50,
): Promise<CrmEmailListItem[]> {
  if (!prisma.crmEmailMessage) {
    return [];
  }

  const or: Array<Record<string, unknown>> = [
    ...(links.contactId ? [{ contact_id: links.contactId }] : []),
    ...(links.leadId ? [{ lead_id: links.leadId }] : []),
    ...(links.companyId ? [{ company_id: links.companyId }] : []),
  ];

  let matchEmail: string | null = null;
  let matchEmailRaw: string | null = null;
  if (links.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: links.contactId, workspace_id: workspaceId },
      select: { email: true },
    });
    matchEmailRaw = contact?.email?.trim() || null;
    matchEmail = matchEmailRaw?.toLowerCase() || null;
  } else if (links.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: links.leadId, workspace_id: workspaceId },
      select: { email: true },
    });
    matchEmailRaw = lead?.email?.trim() || null;
    matchEmail = matchEmailRaw?.toLowerCase() || null;
  }

  if (matchEmail) {
    or.push({ from_address: { equals: matchEmail, mode: "insensitive" } });
    or.push({ to_addresses: { array_contains: matchEmail } });
    if (matchEmailRaw && matchEmailRaw !== matchEmail) {
      or.push({ to_addresses: { array_contains: matchEmailRaw } });
    }
  }

  if (or.length === 0) {
    return [];
  }

  try {
    const rows = await prisma.crmEmailMessage.findMany({
      where: {
        workspace_id: workspaceId,
        folder: { notIn: ["DRAFTS", "TRASH"] },
        OR: or as never,
      },
      orderBy: { message_at: "desc" },
      take: limit,
    });
    return rows.map((row) => serializeEmailMessage(row));
  } catch {
    return [];
  }
}

export async function setEmailMessagePinned(
  workspaceId: string,
  messageId: string,
  pinned: boolean,
): Promise<CrmEmailListItem | null> {
  if (!prisma.crmEmailMessage) {
    throw new Error("Email storage is restarting. Refresh the page and try again.");
  }
  const existing = await prisma.crmEmailMessage.findFirst({
    where: { id: messageId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }
  const row = await prisma.crmEmailMessage.update({
    where: { id: existing.id },
    data: { pinned_at: pinned ? new Date() : null },
  });
  return serializeEmailMessage(row);
}

export function providerDisplayName(provider: EmailSyncProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "Google";
    case "OFFICE365":
      return "Office 365";
    case "EXCHANGE":
      return "Exchange";
    case "IMAP":
      return "Other (IMAP)";
    default:
      return provider;
  }
}
