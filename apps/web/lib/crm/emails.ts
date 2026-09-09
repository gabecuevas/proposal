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
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  messageAt: string;
};

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

  return rows.map((row) => ({
    id: row.id,
    folder: FOLDER_FROM_DB[row.folder],
    fromName: row.from_name ?? "",
    fromAddress: row.from_address,
    subject: row.subject,
    snippet: row.snippet,
    isRead: row.is_read,
    hasAttachments: row.has_attachments,
    messageAt: row.message_at.toISOString(),
  }));
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
