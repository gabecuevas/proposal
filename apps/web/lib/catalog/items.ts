import { prisma } from "@repo/db";

export const CATALOG_ITEM_KINDS = ["product", "service"] as const;
export type CatalogItemKind = (typeof CATALOG_ITEM_KINDS)[number];

export type CatalogItemDto = {
  id: string;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  unitPriceMinor: number;
  currency: string;
  createdAt: string;
};

export const CATALOG_NAME_MAX = 200;
export const CATALOG_PRICE_MAX_MINOR = 99_999_999_99;

export function isCatalogItemKind(value: unknown): value is CatalogItemKind {
  return typeof value === "string" && (CATALOG_ITEM_KINDS as readonly string[]).includes(value);
}

function toDto(row: {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  unit_price_minor: number;
  currency: string;
  created_at: Date;
}): CatalogItemDto {
  return {
    id: row.id,
    kind: row.kind === "service" ? "service" : "product",
    name: row.name,
    description: row.description,
    unitPriceMinor: row.unit_price_minor,
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listCatalogItems(
  workspaceId: string,
  options: { kind?: CatalogItemKind; query?: string; limit?: number } = {},
): Promise<CatalogItemDto[]> {
  const query = options.query?.trim();
  const rows = await prisma.catalogItem.findMany({
    where: {
      workspace_id: workspaceId,
      archived_at: null,
      ...(options.kind ? { kind: options.kind } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ name: "asc" }],
    take: options.limit ?? 200,
  });
  return rows.map(toDto);
}

export class CatalogItemExistsError extends Error {
  constructor(kind: CatalogItemKind, name: string) {
    super(`A ${kind} named "${name}" is already in your catalog.`);
    this.name = "CatalogItemExistsError";
  }
}

export async function createCatalogItem(input: {
  workspaceId: string;
  userId: string;
  kind: CatalogItemKind;
  name: string;
  unitPriceMinor: number;
  currency?: string;
  description?: string | null;
}): Promise<CatalogItemDto> {
  const name = input.name.trim().slice(0, CATALOG_NAME_MAX);
  const duplicate = await prisma.catalogItem.findFirst({
    where: {
      workspace_id: input.workspaceId,
      kind: input.kind,
      archived_at: null,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new CatalogItemExistsError(input.kind, name);
  }
  const row = await prisma.catalogItem.create({
    data: {
      workspace_id: input.workspaceId,
      kind: input.kind,
      name,
      description: input.description?.trim() || null,
      unit_price_minor: input.unitPriceMinor,
      currency: (input.currency || "USD").toUpperCase(),
      created_by: input.userId,
    },
  });
  return toDto(row);
}
