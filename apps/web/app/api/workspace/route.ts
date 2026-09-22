import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { assetUrl } from "@/lib/storage/asset-url";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: { id: true, name: true, logo_asset_key: true },
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }
  return jsonWithRequestId(request, {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      logoAssetKey: workspace.logo_asset_key,
      logoUrl: workspace.logo_asset_key ? assetUrl(workspace.logo_asset_key) : null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const body = (await request.json()) as {
    name?: string;
    logoAssetKey?: string | null;
  };

  const data: { name?: string; logo_asset_key?: string | null } = {};
  if (body.name !== undefined) {
    assertRole(auth, "ADMIN");
    if (!body.name.trim()) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "name is required",
      });
    }
    data.name = body.name.trim();
  }
  if (body.logoAssetKey !== undefined) {
    // Members can set the company logo from Quote/Invoice; name changes stay admin-only.
    assertRole(auth, "MEMBER");
    data.logo_asset_key = body.logoAssetKey?.trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Provide name and/or logoAssetKey",
    });
  }

  const workspace = await prisma.workspace.update({
    where: { id: auth.workspaceId },
    data,
    select: { id: true, name: true, logo_asset_key: true },
  });
  return jsonWithRequestId(request, {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      logoAssetKey: workspace.logo_asset_key,
      logoUrl: workspace.logo_asset_key ? assetUrl(workspace.logo_asset_key) : null,
    },
  });
}
