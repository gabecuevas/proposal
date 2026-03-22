import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { generateApiKeyMaterial, getApiKeyExpiryDate } from "@/lib/auth/api-keys";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

type Params = { params: Promise<{ apiKeyId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const { apiKeyId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    name?: string;
    role?: "OWNER" | "ADMIN" | "MEMBER";
    expiresInDays?: number;
  };
  if (payload.expiresInDays !== undefined && (!Number.isFinite(payload.expiresInDays) || payload.expiresInDays <= 0)) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "expiresInDays must be a positive number",
    });
  }

  const existing = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      workspace_id: auth.workspaceId,
      revoked_at: null,
    },
  });
  if (!existing) {
    return errorResponse(request, {
      status: 404,
      code: "api_key_not_found",
      message: "API key not found",
    });
  }

  const keyMaterial = generateApiKeyMaterial();
  const expiresAt = getApiKeyExpiryDate(payload.expiresInDays);
  const rotated = await prisma.$transaction(async (tx) => {
    await tx.apiKey.update({
      where: { id: existing.id },
      data: {
        revoked_at: new Date(),
      },
    });
    return tx.apiKey.create({
      data: {
        workspace_id: existing.workspace_id,
        name: payload.name?.trim() || existing.name,
        key_prefix: keyMaterial.keyPrefix,
        key_hash: keyMaterial.keyHash,
        role: payload.role ?? existing.role,
        created_by: auth.userId,
        expires_at: expiresAt,
      },
    });
  });

  return jsonWithRequestId(
    request,
    {
      apiKey: {
        id: rotated.id,
        name: rotated.name,
        role: rotated.role,
        key_prefix: rotated.key_prefix,
        expires_at: rotated.expires_at,
      },
      replacedApiKeyId: existing.id,
      secret: keyMaterial.rawKey,
    },
    { status: 201 },
  );
}
