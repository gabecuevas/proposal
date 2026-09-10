import { prisma, type CrmEmailTemplateVisibility } from "@repo/db";

export type CrmEmailTemplateDto = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  visibility: "PRIVATE" | "SHARED";
  updatedAt: string;
};

export function serializeEmailTemplate(row: {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  visibility: CrmEmailTemplateVisibility;
  updated_at: Date;
}): CrmEmailTemplateDto {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.body_html,
    visibility: row.visibility,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listEmailTemplates(workspaceId: string, query?: string) {
  if (!prisma.crmEmailTemplate) {
    throw new Error("Email templates storage is restarting. Refresh and try again.");
  }
  const q = query?.trim();
  const rows = await prisma.crmEmailTemplate.findMany({
    where: {
      workspace_id: workspaceId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { subject: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updated_at: "desc" }, { name: "asc" }],
    take: 100,
  });
  return rows.map(serializeEmailTemplate);
}

export async function getEmailTemplate(workspaceId: string, templateId: string) {
  if (!prisma.crmEmailTemplate) {
    throw new Error("Email templates storage is restarting. Refresh and try again.");
  }
  const row = await prisma.crmEmailTemplate.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
  });
  return row ? serializeEmailTemplate(row) : null;
}

export async function createEmailTemplate(
  workspaceId: string,
  input: {
    name: string;
    subject?: string;
    bodyHtml?: string;
    visibility?: "PRIVATE" | "SHARED";
    userId?: string | null;
  },
) {
  if (!prisma.crmEmailTemplate) {
    throw new Error("Email templates storage is restarting. Refresh and try again.");
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error("Template name is required.");
  }
  const row = await prisma.crmEmailTemplate.create({
    data: {
      workspace_id: workspaceId,
      user_id: input.userId ?? null,
      name,
      subject: input.subject?.trim() ?? "",
      body_html: input.bodyHtml?.trim() || "<p></p>",
      visibility: input.visibility ?? "PRIVATE",
    },
  });
  return serializeEmailTemplate(row);
}

export async function updateEmailTemplate(
  workspaceId: string,
  templateId: string,
  input: {
    name?: string;
    subject?: string;
    bodyHtml?: string;
    visibility?: "PRIVATE" | "SHARED";
  },
) {
  if (!prisma.crmEmailTemplate) {
    throw new Error("Email templates storage is restarting. Refresh and try again.");
  }
  const existing = await prisma.crmEmailTemplate.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
  });
  if (!existing) {
    throw new Error("Email template not found.");
  }
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) {
    throw new Error("Template name is required.");
  }
  const row = await prisma.crmEmailTemplate.update({
    where: { id: existing.id },
    data: {
      name,
      subject: input.subject !== undefined ? input.subject.trim() : existing.subject,
      body_html: input.bodyHtml !== undefined ? input.bodyHtml : existing.body_html,
      visibility: input.visibility ?? existing.visibility,
    },
  });
  return serializeEmailTemplate(row);
}

export async function deleteEmailTemplate(workspaceId: string, templateId: string) {
  if (!prisma.crmEmailTemplate) {
    throw new Error("Email templates storage is restarting. Refresh and try again.");
  }
  const existing = await prisma.crmEmailTemplate.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
  });
  if (!existing) {
    throw new Error("Email template not found.");
  }
  await prisma.crmEmailTemplate.delete({ where: { id: existing.id } });
  return { id: existing.id };
}

/** Replace template field pills/tokens with merge values for compose. */
export function applyEmailTemplateMergeFields(
  html: string,
  fields: Record<string, string | undefined>,
): string {
  let next = html;
  const map: Record<string, string> = {
    first_name: fields.firstName ?? fields.first_name ?? "",
    firstname: fields.firstName ?? fields.first_name ?? "",
    "first name": fields.firstName ?? fields.first_name ?? "",
    last_name: fields.lastName ?? fields.last_name ?? "",
    lastname: fields.lastName ?? fields.last_name ?? "",
    "last name": fields.lastName ?? fields.last_name ?? "",
    full_name: fields.fullName ?? fields.full_name ?? "",
    fullname: fields.fullName ?? fields.full_name ?? "",
    "full name": fields.fullName ?? fields.full_name ?? "",
    email: fields.email ?? "",
    company: fields.companyName ?? fields.company ?? "",
    company_name: fields.companyName ?? fields.company ?? "",
    "company name": fields.companyName ?? fields.company ?? "",
    title: fields.title ?? "",
    sender_name: fields.senderName ?? fields.sender_name ?? "",
    "sender name": fields.senderName ?? fields.sender_name ?? "",
  };

  next = next.replace(
    /<span[^>]*data-email-field=["']([^"']+)["'][^>]*>.*?<\/span>/gi,
    (_match, key: string) => {
      const normalized = key.trim().toLowerCase().replace(/[_-]+/g, " ");
      const value = map[normalized] ?? map[key.trim().toLowerCase()] ?? "";
      return value || `{{${key}}}`;
    },
  );

  next = next.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const normalized = key.trim().toLowerCase().replace(/[_-]+/g, " ");
    return map[normalized] ?? map[key.trim().toLowerCase()] ?? `{{${key.trim()}}}`;
  });

  return next;
}
