import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

type Params = { params: Promise<{ apiKeyId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const { apiKeyId } = await params;
  const key = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      workspace_id: auth.workspaceId,
      revoked_at: null,
    },
  });
  if (!key) {
    return errorResponse(request, {
      status: 404,
      code: "api_key_not_found",
      message: "API key not found",
    });
  }

  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { revoked_at: new Date() },
  });

  return jsonWithRequestId(request, { ok: true, revokedApiKeyId: apiKeyId });
}
