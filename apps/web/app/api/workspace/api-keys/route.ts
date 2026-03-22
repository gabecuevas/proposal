import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { generateApiKeyMaterial, getApiKeyExpiryDate, isApiKeyExpired } from "@/lib/auth/api-keys";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const pagination = parseCursorPagination(request, 50);

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      workspace_id: auth.workspaceId,
      created_at: pagination.before ? { lt: pagination.before } : undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });
  const rows = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    key_prefix: key.key_prefix,
    role: key.role,
    created_at: key.created_at,
    last_used_at: key.last_used_at,
    expires_at: key.expires_at,
    is_expired: isApiKeyExpired(key.expires_at),
    revoked_at: key.revoked_at,
  }));
  const page = getNextCursorFromTimestampPage(rows, pagination.limit, (item) => item.created_at);
  return jsonWithRequestId(request, {
    apiKeys: page.items.map((key) => ({
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      role: key.role,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      is_expired: key.is_expired,
      revoked_at: key.revoked_at,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json()) as {
    name?: string;
    role?: "OWNER" | "ADMIN" | "MEMBER";
    expiresInDays?: number;
  };
  const name = payload.name?.trim();
  if (!name) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "name is required",
    });
  }
  const role = payload.role ?? "MEMBER";
  if (payload.expiresInDays !== undefined && (!Number.isFinite(payload.expiresInDays) || payload.expiresInDays <= 0)) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "expiresInDays must be a positive number",
    });
  }

  const keyMaterial = generateApiKeyMaterial();
  const expiresAt = getApiKeyExpiryDate(payload.expiresInDays);
  const apiKey = await prisma.apiKey.create({
    data: {
      workspace_id: auth.workspaceId,
      name,
      key_prefix: keyMaterial.keyPrefix,
      key_hash: keyMaterial.keyHash,
      role,
      created_by: auth.userId,
      expires_at: expiresAt,
    },
  });

  return jsonWithRequestId(
    request,
    {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        role: apiKey.role,
        key_prefix: apiKey.key_prefix,
        expires_at: apiKey.expires_at,
      },
      secret: keyMaterial.rawKey,
    },
    { status: 201 },
  );
}
