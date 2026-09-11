import { prisma } from "@repo/db";
import {
  CURRENT_DOC_VERSION,
  type EditorDoc,
  type PricingModel,
  type VariableRegistry,
} from "./types";
import { defaultEditorDoc, defaultPricingModel, defaultVariableRegistry } from "./defaults";
import { normalizeEditorDoc } from "./stable";
import { isPageBackedEditorJson } from "./extensions/field-canvas";

export type TemplateKind = "PDF" | "DOCX" | "Custom";

export type TemplateEditorRecord = {
  id: string;
  name: string;
  editor_json: EditorDoc;
  schema_version: number;
  tags: string[];
  variable_registry: VariableRegistry;
  pricing_json: PricingModel;
  folder_id: string | null;
  is_sample: boolean;
  sample_folder_slug: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string;
  updated_by_name: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
  kind: TemplateKind;
};

function inferKind(tags: string[], editor: EditorDoc): TemplateKind {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.includes("docx") || lower.includes("word")) {
    return "DOCX";
  }
  if (lower.includes("pdf") || isPageBackedEditorJson(editor)) {
    return "PDF";
  }
  return "Custom";
}

function parseTemplateJson(
  template: {
    id: string;
    name: string;
    tags: unknown;
    editor_json: unknown;
    schema_version: number;
    variable_registry_json: unknown;
    pricing_json: unknown;
    folder_id: string | null;
    is_sample?: boolean;
    sample_folder_slug?: string | null;
    created_by: string;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    shares?: Array<{ user_id: string; role: string; user?: { name: string; email: string } | null }>;
    owner?: { name: string } | null;
    updater?: { name: string } | null;
  },
  userMap?: Map<string, { name: string; email: string }>,
): TemplateEditorRecord {
  const tags = Array.isArray(template.tags) ? (template.tags as string[]) : [];
  const editor = normalizeEditorDoc((template.editor_json as EditorDoc) ?? defaultEditorDoc);
  const variableRegistry = template.variable_registry_json;
  const ownerName =
    template.owner?.name ??
    userMap?.get(template.created_by)?.name ??
    "Unknown";
  const updatedByName =
    template.updater?.name ??
    (template.updated_by ? userMap?.get(template.updated_by)?.name ?? null : null);

  const shared_with = (template.shares ?? []).map((share) => ({
    user_id: share.user_id,
    role: share.role,
    name: share.user?.name ?? userMap?.get(share.user_id)?.name ?? "Member",
    email: share.user?.email ?? userMap?.get(share.user_id)?.email ?? "",
  }));

  return {
    id: template.id,
    name: template.name,
    editor_json: editor,
    schema_version: template.schema_version,
    tags,
    variable_registry: (variableRegistry as VariableRegistry) ?? defaultVariableRegistry,
    pricing_json: (template.pricing_json as PricingModel) ?? defaultPricingModel,
    folder_id: template.folder_id,
    is_sample: Boolean(template.is_sample),
    sample_folder_slug: template.sample_folder_slug ?? null,
    created_by: template.created_by,
    updated_by: template.updated_by,
    created_at: template.created_at.toISOString(),
    updated_at: template.updated_at.toISOString(),
    owner_name: ownerName,
    updated_by_name: updatedByName,
    shared_with,
    kind: inferKind(tags, editor),
  };
}

async function loadUserMap(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
}

export async function createTemplate(input: {
  name: string;
  workspaceId: string;
  createdBy: string;
  editor_json?: EditorDoc;
  tags?: string[];
  folder_id?: string | null;
  is_sample?: boolean;
  sample_folder_slug?: string | null;
}): Promise<TemplateEditorRecord> {
  const row = await prisma.template.create({
    data: {
      workspace_id: input.workspaceId,
      name: input.name,
      tags: input.tags ?? [],
      variable_registry_json: defaultVariableRegistry,
      pricing_json: defaultPricingModel,
      editor_json: input.editor_json ? normalizeEditorDoc(input.editor_json) : defaultEditorDoc,
      schema_version: CURRENT_DOC_VERSION,
      created_by: input.createdBy,
      updated_by: input.createdBy,
      folder_id: input.is_sample ? null : (input.folder_id ?? null),
      is_sample: Boolean(input.is_sample),
      sample_folder_slug: input.is_sample ? (input.sample_folder_slug ?? null) : null,
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap([row.created_by, row.updated_by ?? ""]);
  return parseTemplateJson(row, userMap);
}

export async function getTemplate(
  templateId: string,
  workspaceId: string,
): Promise<TemplateEditorRecord | null> {
  const row = await prisma.template.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
    include: { shares: true },
  });
  if (!row) {
    return null;
  }
  const userMap = await loadUserMap([
    row.created_by,
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseTemplateJson(row, userMap);
}

export async function listTemplates(
  workspaceId: string,
  options?: {
    limit?: number;
    before?: Date;
    query?: string;
    tag?: string;
    folderId?: string | null;
  },
): Promise<TemplateEditorRecord[]> {
  const query = options?.query?.trim();
  const tag = options?.tag?.trim();
  const rows = await prisma.template.findMany({
    where: {
      workspace_id: workspaceId,
      is_sample: false,
      created_at: options?.before ? { lt: options.before } : undefined,
      name: query ? { contains: query, mode: "insensitive" } : undefined,
      tags: tag ? { array_contains: [tag] } : undefined,
      folder_id: options?.folderId === undefined ? undefined : options.folderId,
    },
    include: { shares: true },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 20,
  });
  const userMap = await loadUserMap(
    rows.flatMap((r) => [r.created_by, r.updated_by ?? "", ...r.shares.map((s) => s.user_id)]),
  );
  return rows.map((row) => parseTemplateJson(row, userMap));
}

export async function updateTemplate(
  templateId: string,
  workspaceId: string,
  input: {
    name?: string;
    editor_json?: EditorDoc;
    variable_registry?: VariableRegistry;
    pricing_json?: PricingModel;
    folder_id?: string | null;
    updatedBy?: string;
  },
): Promise<TemplateEditorRecord | null> {
  const existing = await getTemplate(templateId, workspaceId);
  if (!existing) {
    return null;
  }

  const row = await prisma.template.update({
    where: { id: templateId },
    data: {
      name: input.name ?? existing.name,
      editor_json: input.editor_json ? normalizeEditorDoc(input.editor_json) : existing.editor_json,
      schema_version: CURRENT_DOC_VERSION,
      tags: existing.tags,
      variable_registry_json: input.variable_registry ?? existing.variable_registry,
      pricing_json: input.pricing_json ?? existing.pricing_json,
      folder_id: input.folder_id === undefined ? existing.folder_id : input.folder_id,
      updated_by: input.updatedBy ?? existing.updated_by,
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap([
    row.created_by,
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseTemplateJson(row, userMap);
}

export async function deleteTemplate(templateId: string, workspaceId: string): Promise<boolean> {
  const existing = await prisma.template.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return false;
  }
  await prisma.template.delete({ where: { id: templateId } });
  return true;
}

export async function duplicateTemplate(input: {
  templateId: string;
  workspaceId: string;
  createdBy: string;
  name?: string;
}): Promise<TemplateEditorRecord | null> {
  const existing = await getTemplate(input.templateId, input.workspaceId);
  if (!existing) {
    return null;
  }
  return createTemplate({
    name: input.name?.trim() || `${existing.name} (copy)`,
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    editor_json: existing.editor_json,
    tags: [...existing.tags.filter((t) => t !== "copy"), "copy"],
    folder_id: existing.folder_id,
  });
}

export async function listSampleTemplates(options?: {
  folderSlug?: string | null;
  query?: string;
  limit?: number;
}): Promise<TemplateEditorRecord[]> {
  const query = options?.query?.trim();
  const folderSlug = options?.folderSlug?.trim() || null;
  const rows = await prisma.template.findMany({
    where: {
      is_sample: true,
      sample_folder_slug: folderSlug ?? undefined,
      name: query ? { contains: query, mode: "insensitive" } : undefined,
    },
    include: { shares: true },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 200,
  });
  const userMap = await loadUserMap(
    rows.flatMap((r) => [r.created_by, r.updated_by ?? "", ...r.shares.map((s) => s.user_id)]),
  );
  return rows.map((row) => parseTemplateJson(row, userMap));
}

export async function countSampleTemplatesByFolder(): Promise<Record<string, number>> {
  const rows = await prisma.template.groupBy({
    by: ["sample_folder_slug"],
    where: { is_sample: true, sample_folder_slug: { not: null } },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.sample_folder_slug) {
      counts[row.sample_folder_slug] = row._count._all;
    }
  }
  return counts;
}

export async function getSampleTemplate(templateId: string): Promise<TemplateEditorRecord | null> {
  const row = await prisma.template.findFirst({
    where: { id: templateId, is_sample: true },
    include: { shares: true },
  });
  if (!row) {
    return null;
  }
  const userMap = await loadUserMap([
    row.created_by,
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseTemplateJson(row, userMap);
}

export async function copySampleTemplateToLibrary(input: {
  templateId: string;
  workspaceId: string;
  createdBy: string;
  name?: string;
}): Promise<TemplateEditorRecord | null> {
  const existing = await getSampleTemplate(input.templateId);
  if (!existing) {
    return null;
  }
  return createTemplate({
    name: input.name?.trim() || existing.name,
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    editor_json: existing.editor_json,
    tags: [
      ...existing.tags.filter((tag) => tag !== "sample" && !tag.startsWith("sample-folder:")),
      "from-sample",
    ],
    folder_id: null,
    is_sample: false,
  });
}

export async function setTemplateShares(input: {
  templateId: string;
  workspaceId: string;
  userIds: string[];
  role?: string;
}): Promise<TemplateEditorRecord | null> {
  const existing = await getTemplate(input.templateId, input.workspaceId);
  if (!existing) {
    return null;
  }
  const unique = [...new Set(input.userIds)];
  await prisma.templateShare.deleteMany({ where: { template_id: input.templateId } });
  if (unique.length > 0) {
    await prisma.templateShare.createMany({
      data: unique.map((user_id) => ({
        template_id: input.templateId,
        user_id,
        role: input.role ?? "viewer",
      })),
    });
  }
  return getTemplate(input.templateId, input.workspaceId);
}

export type TemplateFolderRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Templates stored directly in this folder (not nested children). */
  template_count: number;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

async function templateCountsByFolder(
  workspaceId: string,
  folderIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (folderIds.length === 0) {
    return counts;
  }
  const rows = await prisma.template.groupBy({
    by: ["folder_id"],
    where: { workspace_id: workspaceId, folder_id: { in: folderIds } },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (row.folder_id) {
      counts.set(row.folder_id, row._count._all);
    }
  }
  return counts;
}

function mapFolderRows(
  rows: Array<{
    id: string;
    name: string;
    parent_id: string | null;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    shares: Array<{ user_id: string; role: string }>;
  }>,
  userMap: Map<string, { name: string; email: string }>,
  templateCounts: Map<string, number>,
): TemplateFolderRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    template_count: templateCounts.get(row.id) ?? 0,
    shared_with: row.shares.map((share) => ({
      user_id: share.user_id,
      role: share.role,
      name: userMap.get(share.user_id)?.name ?? "Member",
      email: userMap.get(share.user_id)?.email ?? "",
    })),
  }));
}

export async function listTemplateFolders(
  workspaceId: string,
  parentId: string | null = null,
): Promise<TemplateFolderRecord[]> {
  const rows = await prisma.templateFolder.findMany({
    where: { workspace_id: workspaceId, parent_id: parentId },
    include: { shares: true },
    orderBy: [{ name: "asc" }],
  });
  const userMap = await loadUserMap(rows.flatMap((r) => r.shares.map((s) => s.user_id)));
  const templateCounts = await templateCountsByFolder(
    workspaceId,
    rows.map((row) => row.id),
  );
  return mapFolderRows(rows, userMap, templateCounts);
}

export async function listAllTemplateFolders(workspaceId: string): Promise<TemplateFolderRecord[]> {
  const rows = await prisma.templateFolder.findMany({
    where: { workspace_id: workspaceId },
    include: { shares: true },
    orderBy: [{ name: "asc" }],
  });
  const userMap = await loadUserMap(rows.flatMap((r) => r.shares.map((s) => s.user_id)));
  const templateCounts = await templateCountsByFolder(
    workspaceId,
    rows.map((row) => row.id),
  );
  return mapFolderRows(rows, userMap, templateCounts);
}

export async function createTemplateFolder(input: {
  workspaceId: string;
  createdBy: string;
  name: string;
  parentId?: string | null;
}): Promise<TemplateFolderRecord> {
  const row = await prisma.templateFolder.create({
    data: {
      workspace_id: input.workspaceId,
      name: input.name.trim() || "Untitled folder",
      parent_id: input.parentId ?? null,
      created_by: input.createdBy,
    },
    include: { shares: true },
  });
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    template_count: 0,
    shared_with: [],
  };
}

export async function renameTemplateFolder(input: {
  folderId: string;
  workspaceId: string;
  name: string;
}): Promise<TemplateFolderRecord | null> {
  const existing = await prisma.templateFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return null;
  }
  const row = await prisma.templateFolder.update({
    where: { id: input.folderId },
    data: { name: input.name.trim() || existing.name },
    include: { shares: true },
  });
  const templateCounts = await templateCountsByFolder(input.workspaceId, [row.id]);
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    template_count: templateCounts.get(row.id) ?? 0,
    shared_with: [],
  };
}

export async function deleteTemplateFolder(input: {
  folderId: string;
  workspaceId: string;
}): Promise<boolean> {
  const existing = await prisma.templateFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return false;
  }
  // Move templates in this folder to parent (or root) before delete cascades folders.
  await prisma.template.updateMany({
    where: { folder_id: input.folderId, workspace_id: input.workspaceId },
    data: { folder_id: existing.parent_id },
  });
  await prisma.templateFolder.delete({ where: { id: input.folderId } });
  return true;
}

export async function setFolderShares(input: {
  folderId: string;
  workspaceId: string;
  userIds: string[];
  role?: string;
}): Promise<TemplateFolderRecord | null> {
  const existing = await prisma.templateFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return null;
  }
  const unique = [...new Set(input.userIds)];
  await prisma.templateFolderShare.deleteMany({ where: { folder_id: input.folderId } });
  if (unique.length > 0) {
    await prisma.templateFolderShare.createMany({
      data: unique.map((user_id) => ({
        folder_id: input.folderId,
        user_id,
        role: input.role ?? "viewer",
      })),
    });
  }
  const folders = await listTemplateFolders(input.workspaceId, existing.parent_id);
  return folders.find((f) => f.id === input.folderId) ?? null;
}
