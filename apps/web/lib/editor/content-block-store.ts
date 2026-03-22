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
  updated_at: string;
};

function parseContentBlock(block: {
  id: string;
  name: string;
  block_type: string;
  version: number;
  schema_version: number;
  editor_json: unknown;
  updated_at: Date;
}): ContentBlockRecord {
  return {
    id: block.id,
    name: block.name,
    block_type: block.block_type,
    version: block.version,
    schema_version: block.schema_version,
    editor_json: normalizeEditorDoc((block.editor_json as EditorDoc) ?? defaultEditorDoc),
    updated_at: block.updated_at.toISOString(),
  };
}

export async function listContentBlocks(
  workspaceId: string,
  options?: { limit?: number; before?: Date },
): Promise<ContentBlockRecord[]> {
  const rows = await prisma.contentBlock.findMany({
    where: {
      workspace_id: workspaceId,
      updated_at: options?.before ? { lt: options.before } : undefined,
    },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });
  return rows.map(parseContentBlock);
}

export async function createContentBlock(input: {
  workspaceId: string;
  name: string;
  block_type: string;
  editor_json?: EditorDoc;
}): Promise<ContentBlockRecord> {
  const row = await prisma.contentBlock.create({
    data: {
      workspace_id: input.workspaceId,
      name: input.name,
      block_type: input.block_type,
      editor_json: input.editor_json ?? defaultEditorDoc,
      version: 1,
      schema_version: CURRENT_DOC_VERSION,
    },
  });
  return parseContentBlock(row);
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
  });
  return parseContentBlock(row);
}
