import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { verifyAssetToken } from "@/lib/auth/asset-download";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { keyBelongsToWorkspace } from "@/lib/storage/asset-url";
import { getObject } from "@/lib/storage/object-store";

async function resolveWorkspaceId(request: NextRequest): Promise<string | null> {
  const token = request.nextUrl.searchParams.get("token");
  if (token) {
    const payload = await verifyAssetToken(token);
    return payload?.workspaceId ?? null;
  }
  try {
    const auth = await getRequestAuthContext(request);
    return auth.workspaceId;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  const workspaceId = await resolveWorkspaceId(request);
  if (!workspaceId) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Authentication required",
    });
  }

  if (!keyBelongsToWorkspace(key, workspaceId)) {
    return errorResponse(request, {
      status: 404,
      code: "asset_not_found",
      message: "Asset not found",
    });
  }

  const object = await getObject(key);
  if (!object) {
    return errorResponse(request, {
      status: 404,
      code: "asset_not_found",
      message: "Asset not found",
    });
  }

  return new NextResponse(Buffer.from(object.bytes), {
    status: 200,
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
    },
  });
}
