import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { validateCompanyWebsite } from "@/lib/auth/company-website";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";
import { assetUrl } from "@/lib/storage/asset-url";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  personalTimezone: z.string().trim().min(1).max(80).optional().nullable(),
  avatarAssetKey: z.string().trim().max(500).optional().nullable(),
  companyName: z.string().trim().min(2).max(120).optional(),
  domainName: z.string().trim().max(500).optional().nullable(),
  noWebsite: z.boolean().optional(),
});

function mapProfile(input: {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    personal_timezone: string | null;
    avatar_asset_key: string | null;
    provisional_company_name: string | null;
  };
  workspace: {
    id: string;
    name: string;
    website: string | null;
    no_website: boolean;
  } | null;
  role: string | null;
}) {
  const { user, workspace, role } = input;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    personalTimezone: user.personal_timezone,
    avatarAssetKey: user.avatar_asset_key,
    avatarUrl: user.avatar_asset_key ? assetUrl(user.avatar_asset_key) : null,
    companyName: workspace?.name ?? user.provisional_company_name ?? "",
    domainName: workspace?.no_website ? "" : (workspace?.website ?? ""),
    noWebsite: workspace?.no_website ?? false,
    workspaceId: workspace?.id ?? null,
    role,
  };
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  personal_timezone: true,
  avatar_asset_key: true,
  provisional_company_name: true,
} as const;

export async function GET(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: userSelect,
  });
  if (!user) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }

  const workspace = session.workspaceId
    ? await prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: { id: true, name: true, website: true, no_website: true },
      })
    : null;

  return jsonWithRequestId(request, {
    profile: mapProfile({ user, workspace, role: session.role }),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid profile payload",
    });
  }

  const body = parsed.data;
  const userData: {
    name?: string;
    phone?: string | null;
    personal_timezone?: string | null;
    avatar_asset_key?: string | null;
  } = {};
  if (body.name !== undefined) userData.name = body.name;
  if (body.phone !== undefined) userData.phone = body.phone?.trim() || null;
  if (body.personalTimezone !== undefined) {
    userData.personal_timezone = body.personalTimezone;
  }
  if (body.avatarAssetKey !== undefined) {
    userData.avatar_asset_key = body.avatarAssetKey?.trim() || null;
  }

  const wantsWorkspaceUpdate =
    body.companyName !== undefined ||
    body.domainName !== undefined ||
    body.noWebsite !== undefined;

  const workspacePatch: {
    name?: string;
    website?: string | null;
    no_website?: boolean;
  } = {};

  if (wantsWorkspaceUpdate) {
    if (!session.workspaceId || !session.role) {
      return errorResponse(request, {
        status: 403,
        code: "forbidden",
        message: "Complete company setup before editing company fields.",
      });
    }
    try {
      const auth = await getRequestAuthContext(request);
      assertRole(auth, "ADMIN");
    } catch {
      return errorResponse(request, {
        status: 403,
        code: "forbidden",
        message: "Only owners and admins can update company name or domain.",
      });
    }

    if (body.companyName !== undefined) {
      workspacePatch.name = body.companyName;
    }
    if (body.noWebsite === true) {
      workspacePatch.no_website = true;
      workspacePatch.website = null;
    } else if (body.domainName !== undefined) {
      if (!body.domainName?.trim()) {
        workspacePatch.website = null;
      } else {
        const validated = validateCompanyWebsite(body.domainName);
        if (!validated.ok) {
          return errorResponse(request, {
            status: 400,
            code: "validation_error",
            message: validated.error,
          });
        }
        workspacePatch.website = validated.href;
        workspacePatch.no_website = false;
      }
    }
  }

  if (Object.keys(userData).length === 0 && Object.keys(workspacePatch).length === 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "No updatable fields provided",
    });
  }

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: session.userId },
      data: userData,
      select: userSelect,
    });
    if (session.workspaceId && Object.keys(workspacePatch).length > 0) {
      await tx.workspace.update({
        where: { id: session.workspaceId },
        data: workspacePatch,
      });
    }
    return updatedUser;
  });

  const workspace = session.workspaceId
    ? await prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: { id: true, name: true, website: true, no_website: true },
      })
    : null;

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const payload = await buildSessionPayloadFromUser(fullUser);
  return jsonWithSessionCookie(
    request,
    {
      profile: mapProfile({
        user,
        workspace,
        role: session.role,
      }),
    },
    payload,
  );
}
