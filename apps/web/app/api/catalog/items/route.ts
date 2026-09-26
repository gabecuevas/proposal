import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole } from "@/lib/auth/request-context";
import { requireRequestAuth } from "@/lib/auth/require-request-auth";
import {
  CATALOG_PRICE_MAX_MINOR,
  CatalogItemExistsError,
  createCatalogItem,
  isCatalogItemKind,
  listCatalogItems,
} from "@/lib/catalog/items";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const items = await listCatalogItems(auth.workspaceId, {
    kind: isCatalogItemKind(kind) ? kind : undefined,
    query: url.searchParams.get("q") ?? undefined,
    limit: Number.isFinite(limit) ? Math.min(200, Math.max(1, limit)) : 200,
  });
  return jsonWithRequestId(request, { items });
}

type CreateBody = {
  kind?: unknown;
  name?: unknown;
  unitPriceMinor?: unknown;
  currency?: unknown;
  description?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  assertRole(auth, "MEMBER");
  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = body.unitPriceMinor;
  if (!isCatalogItemKind(body.kind)) {
    return errorResponse(request, { status: 400, code: "validation_error", message: "Choose Product or Service" });
  }
  if (!name) {
    return errorResponse(request, { status: 400, code: "validation_error", message: "Name is required" });
  }
  if (typeof price !== "number" || !Number.isInteger(price) || price < 0 || price > CATALOG_PRICE_MAX_MINOR) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Enter a valid unit price",
    });
  }
  try {
    const item = await createCatalogItem({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      kind: body.kind,
      name,
      unitPriceMinor: price,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      description: typeof body.description === "string" ? body.description : null,
    });
    return jsonWithRequestId(request, { item }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogItemExistsError) {
      return errorResponse(request, { status: 409, code: "catalog_item_exists", message: error.message });
    }
    throw error;
  }
}
