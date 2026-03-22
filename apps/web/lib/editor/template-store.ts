import { prisma } from "@repo/db";
import {
  CURRENT_DOC_VERSION,
  type EditorDoc,
  type PricingModel,
  type VariableRegistry,
} from "./types";
import { defaultEditorDoc, defaultPricingModel, defaultVariableRegistry } from "./defaults";
import { normalizeEditorDoc } from "./stable";

export type TemplateEditorRecord = {
  id: string;
  name: string;
  editor_json: EditorDoc;
  schema_version: number;
  tags: string[];
  variable_registry: VariableRegistry;
  pricing_json: PricingModel;
  created_at: string;
};

function parseTemplateJson(template: {
  id: string;
  name: string;
  tags: unknown;
  editor_json: unknown;
  schema_version: number;
  variable_registry_json: unknown;
  pricing_json: unknown;
  created_at: Date;
}): TemplateEditorRecord {
  const tags = Array.isArray(template.tags) ? (template.tags as string[]) : [];
  const editor = normalizeEditorDoc((template.editor_json as EditorDoc) ?? defaultEditorDoc);
  const variableRegistry = template.variable_registry_json;

  return {
    id: template.id,
    name: template.name,
    editor_json: editor,
    schema_version: template.schema_version,
    tags,
    variable_registry: (variableRegistry as VariableRegistry) ?? defaultVariableRegistry,
    pricing_json: (template.pricing_json as PricingModel) ?? defaultPricingModel,
    created_at: template.created_at.toISOString(),
  };
}

export async function createTemplate(input: {
  name: string;
  workspaceId: string;
  createdBy: string;
}): Promise<TemplateEditorRecord> {
  const row = await prisma.template.create({
    data: {
      workspace_id: input.workspaceId,
      name: input.name,
      tags: [],
      variable_registry_json: defaultVariableRegistry,
      pricing_json: defaultPricingModel,
      editor_json: defaultEditorDoc,
      schema_version: CURRENT_DOC_VERSION,
      created_by: input.createdBy,
    },
  });

  return parseTemplateJson(row);
}

export async function getTemplate(
  templateId: string,
  workspaceId: string,
): Promise<TemplateEditorRecord | null> {
  const row = await prisma.template.findFirst({
    where: { id: templateId, workspace_id: workspaceId },
  });
  if (!row) {
    return null;
  }
  return parseTemplateJson(row);
}

export async function listTemplates(
  workspaceId: string,
  options?: { limit?: number; before?: Date; query?: string; tag?: string },
): Promise<TemplateEditorRecord[]> {
  const query = options?.query?.trim();
  const tag = options?.tag?.trim();
  const rows = await prisma.template.findMany({
    where: {
      workspace_id: workspaceId,
      created_at: options?.before ? { lt: options.before } : undefined,
      name: query ? { contains: query, mode: "insensitive" } : undefined,
      tags: tag ? { array_contains: [tag] } : undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 20,
  });
  return rows.map(parseTemplateJson);
}

export async function updateTemplate(
  templateId: string,
  workspaceId: string,
  input: {
    name?: string;
    editor_json?: EditorDoc;
    variable_registry?: VariableRegistry;
    pricing_json?: PricingModel;
  },
): Promise<TemplateEditorRecord | null> {
  const existing = await getTemplate(templateId, workspaceId);
  if (!existing) {
    return null;
  }

  const tags = [...existing.tags] as string[];
  const row = await prisma.template.update({
    where: { id: templateId },
    data: {
      name: input.name ?? existing.name,
      editor_json: input.editor_json ? normalizeEditorDoc(input.editor_json) : existing.editor_json,
      schema_version: CURRENT_DOC_VERSION,
      tags,
      variable_registry_json: input.variable_registry ?? existing.variable_registry,
      pricing_json: input.pricing_json ?? existing.pricing_json,
    },
  });
  return parseTemplateJson(row);
}
