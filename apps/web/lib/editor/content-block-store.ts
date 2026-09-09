import { prisma } from "@repo/db";
import { CURRENT_DOC_VERSION, type EditorDoc } from "./types";
import { defaultEditorDoc } from "./defaults";
import { normalizeEditorDoc } from "./stable";

export type ContentBlockRecord = {
  id: string;
  name: string;
  block_type: string;
  version: number;
  schema_version: number;
  editor_json: EditorDoc;
  folder_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string;
  updated_by_name: string | null;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

export type ContentBlockFolderRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_with: Array<{ user_id: string; name: string; email: string; role: string }>;
};

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

function parseContentBlock(
  block: {
    id: string;
    name: string;
    block_type: string;
    version: number;
    schema_version: number;
    editor_json: unknown;
    folder_id: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
    shares?: Array<{ user_id: string; role: string }>;
  },
  userMap?: Map<string, { name: string; email: string }>,
): ContentBlockRecord {
  const createdBy = block.created_by ?? "";
  const updatedBy = block.updated_by ?? "";
  return {
    id: block.id,
    name: block.name,
    block_type: block.block_type,
    version: block.version,
    schema_version: block.schema_version,
    editor_json: normalizeEditorDoc((block.editor_json as EditorDoc) ?? defaultEditorDoc),
    folder_id: block.folder_id,
    created_by: block.created_by,
    updated_by: block.updated_by,
    created_at: block.created_at.toISOString(),
    updated_at: block.updated_at.toISOString(),
    owner_name: (createdBy && userMap?.get(createdBy)?.name) || "Workspace",
    updated_by_name: updatedBy ? userMap?.get(updatedBy)?.name ?? null : null,
    shared_with: (block.shares ?? []).map((share) => ({
      user_id: share.user_id,
      role: share.role,
      name: userMap?.get(share.user_id)?.name ?? "Member",
      email: userMap?.get(share.user_id)?.email ?? "",
    })),
  };
}

export async function listContentBlocks(
  workspaceId: string,
  options?: {
    limit?: number;
    before?: Date;
    query?: string;
    blockType?: string;
    folderId?: string | null;
  },
): Promise<ContentBlockRecord[]> {
  const query = options?.query?.trim();
  const blockType = options?.blockType?.trim();
  const rows = await prisma.contentBlock.findMany({
    where: {
      workspace_id: workspaceId,
      updated_at: options?.before ? { lt: options.before } : undefined,
      block_type: blockType || undefined,
      folder_id: options?.folderId === undefined ? undefined : options.folderId,
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { block_type: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { shares: true },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });
  const userMap = await loadUserMap(
    rows.flatMap((r) => [r.created_by ?? "", r.updated_by ?? "", ...r.shares.map((s) => s.user_id)]),
  );
  return rows.map((row) => parseContentBlock(row, userMap));
}

export async function createContentBlock(input: {
  workspaceId: string;
  name: string;
  block_type: string;
  editor_json?: EditorDoc;
  folder_id?: string | null;
  createdBy?: string;
}): Promise<ContentBlockRecord> {
  const row = await prisma.contentBlock.create({
    data: {
      workspace_id: input.workspaceId,
      name: input.name,
      block_type: input.block_type,
      editor_json: input.editor_json ?? defaultEditorDoc,
      version: 1,
      schema_version: CURRENT_DOC_VERSION,
      folder_id: input.folder_id ?? null,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap([row.created_by ?? "", row.updated_by ?? ""]);
  return parseContentBlock(row, userMap);
}

export async function getContentBlock(
  blockId: string,
  workspaceId: string,
): Promise<ContentBlockRecord | null> {
  const row = await prisma.contentBlock.findFirst({
    where: { id: blockId, workspace_id: workspaceId },
    include: { shares: true },
  });
  if (!row) {
    return null;
  }
  const userMap = await loadUserMap([
    row.created_by ?? "",
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseContentBlock(row, userMap);
}

export async function getContentBlocksByIds(
  workspaceId: string,
  blockIds: string[],
): Promise<ContentBlockRecord[]> {
  if (blockIds.length === 0) {
    return [];
  }
  const rows = await prisma.contentBlock.findMany({
    where: {
      workspace_id: workspaceId,
      id: { in: blockIds },
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap(
    rows.flatMap((r) => [r.created_by ?? "", r.updated_by ?? "", ...r.shares.map((s) => s.user_id)]),
  );
  return rows.map((row) => parseContentBlock(row, userMap));
}

export async function updateContentBlock(
  blockId: string,
  workspaceId: string,
  input: {
    name?: string;
    block_type?: string;
    editor_json?: EditorDoc;
    folder_id?: string | null;
    updatedBy?: string;
  },
): Promise<ContentBlockRecord | null> {
  const existing = await getContentBlock(blockId, workspaceId);
  if (!existing) {
    return null;
  }
  const row = await prisma.contentBlock.update({
    where: { id: blockId },
    data: {
      name: input.name ?? existing.name,
      block_type: input.block_type ?? existing.block_type,
      editor_json: input.editor_json
        ? normalizeEditorDoc(input.editor_json)
        : existing.editor_json,
      folder_id: input.folder_id === undefined ? existing.folder_id : input.folder_id,
      updated_by: input.updatedBy ?? existing.updated_by,
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap([
    row.created_by ?? "",
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseContentBlock(row, userMap);
}

export async function deleteContentBlock(blockId: string, workspaceId: string): Promise<boolean> {
  const existing = await prisma.contentBlock.findFirst({
    where: { id: blockId, workspace_id: workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return false;
  }
  await prisma.contentBlock.delete({ where: { id: blockId } });
  return true;
}

export async function duplicateContentBlock(input: {
  blockId: string;
  workspaceId: string;
  createdBy: string;
  name?: string;
}): Promise<ContentBlockRecord | null> {
  const existing = await getContentBlock(input.blockId, input.workspaceId);
  if (!existing) {
    return null;
  }
  return createContentBlock({
    workspaceId: input.workspaceId,
    name: input.name?.trim() || `${existing.name} (copy)`,
    block_type: existing.block_type,
    editor_json: existing.editor_json,
    folder_id: existing.folder_id,
    createdBy: input.createdBy,
  });
}

export async function setContentBlockShares(input: {
  blockId: string;
  workspaceId: string;
  userIds: string[];
  role?: string;
}): Promise<ContentBlockRecord | null> {
  const existing = await getContentBlock(input.blockId, input.workspaceId);
  if (!existing) {
    return null;
  }
  const unique = [...new Set(input.userIds)];
  await prisma.contentBlockShare.deleteMany({ where: { block_id: input.blockId } });
  if (unique.length > 0) {
    await prisma.contentBlockShare.createMany({
      data: unique.map((user_id) => ({
        block_id: input.blockId,
        user_id,
        role: input.role ?? "viewer",
      })),
    });
  }
  return getContentBlock(input.blockId, input.workspaceId);
}

export async function bumpContentBlockVersion(
  blockId: string,
  workspaceId: string,
  editor_json: EditorDoc,
): Promise<ContentBlockRecord | null> {
  const existing = await prisma.contentBlock.findFirst({
    where: { id: blockId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }

  const row = await prisma.contentBlock.update({
    where: { id: blockId },
    data: {
      editor_json: normalizeEditorDoc(editor_json),
      version: existing.version + 1,
      schema_version: CURRENT_DOC_VERSION,
    },
    include: { shares: true },
  });
  const userMap = await loadUserMap([
    row.created_by ?? "",
    row.updated_by ?? "",
    ...row.shares.map((s) => s.user_id),
  ]);
  return parseContentBlock(row, userMap);
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
): ContentBlockFolderRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    shared_with: row.shares.map((share) => ({
      user_id: share.user_id,
      role: share.role,
      name: userMap.get(share.user_id)?.name ?? "Member",
      email: userMap.get(share.user_id)?.email ?? "",
    })),
  }));
}

export async function listContentBlockFolders(
  workspaceId: string,
  parentId: string | null = null,
): Promise<ContentBlockFolderRecord[]> {
  const rows = await prisma.contentBlockFolder.findMany({
    where: { workspace_id: workspaceId, parent_id: parentId },
    include: { shares: true },
    orderBy: [{ name: "asc" }],
  });
  const userMap = await loadUserMap(rows.flatMap((r) => r.shares.map((s) => s.user_id)));
  return mapFolderRows(rows, userMap);
}

export async function listAllContentBlockFolders(
  workspaceId: string,
): Promise<ContentBlockFolderRecord[]> {
  const rows = await prisma.contentBlockFolder.findMany({
    where: { workspace_id: workspaceId },
    include: { shares: true },
    orderBy: [{ name: "asc" }],
  });
  const userMap = await loadUserMap(rows.flatMap((r) => r.shares.map((s) => s.user_id)));
  return mapFolderRows(rows, userMap);
}

export async function createContentBlockFolder(input: {
  workspaceId: string;
  createdBy: string;
  name: string;
  parentId?: string | null;
}): Promise<ContentBlockFolderRecord> {
  const row = await prisma.contentBlockFolder.create({
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
    shared_with: [],
  };
}

export async function renameContentBlockFolder(input: {
  folderId: string;
  workspaceId: string;
  name: string;
}): Promise<ContentBlockFolderRecord | null> {
  const existing = await prisma.contentBlockFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return null;
  }
  const row = await prisma.contentBlockFolder.update({
    where: { id: input.folderId },
    data: { name: input.name.trim() || existing.name },
    include: { shares: true },
  });
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    shared_with: [],
  };
}

export async function deleteContentBlockFolder(input: {
  folderId: string;
  workspaceId: string;
}): Promise<boolean> {
  const existing = await prisma.contentBlockFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return false;
  }
  await prisma.contentBlock.updateMany({
    where: { folder_id: input.folderId, workspace_id: input.workspaceId },
    data: { folder_id: existing.parent_id },
  });
  await prisma.contentBlockFolder.delete({ where: { id: input.folderId } });
  return true;
}

export async function setContentBlockFolderShares(input: {
  folderId: string;
  workspaceId: string;
  userIds: string[];
  role?: string;
}): Promise<ContentBlockFolderRecord | null> {
  const existing = await prisma.contentBlockFolder.findFirst({
    where: { id: input.folderId, workspace_id: input.workspaceId },
  });
  if (!existing) {
    return null;
  }
  const unique = [...new Set(input.userIds)];
  await prisma.contentBlockFolderShare.deleteMany({ where: { folder_id: input.folderId } });
  if (unique.length > 0) {
    await prisma.contentBlockFolderShare.createMany({
      data: unique.map((user_id) => ({
        folder_id: input.folderId,
        user_id,
        role: input.role ?? "viewer",
      })),
    });
  }
  const folders = await listContentBlockFolders(input.workspaceId, existing.parent_id);
  return folders.find((f) => f.id === input.folderId) ?? null;
}
