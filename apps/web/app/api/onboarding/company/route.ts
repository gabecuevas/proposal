import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { validateCompanyWebsite, slugifyWorkspaceName } from "@/lib/auth/company-website";
import { companySetupSchema } from "@/lib/auth/onboarding-schemas";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

async function pickUniqueSlug(name: string): Promise<string> {
  let slug = slugifyWorkspaceName(name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }
    slug = `${slugifyWorkspaceName(name)}-${attempt + 2}`;
  }
  return `${slugifyWorkspaceName(name)}-${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  if (!session.emailVerified) {
    return errorResponse(request, {
      status: 403,
      code: "email_not_verified",
      message: "Verify your email before setting up your company.",
    });
  }

  const parsed = companySetupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid company setup payload",
    });
  }

  const data = parsed.data;
  let website: string | null = null;
  if (!data.noWebsite && data.website?.trim()) {
    const validated = validateCompanyWebsite(data.website);
    if (!validated.ok) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: validated.error,
      });
    }
    website = validated.href;
  }

  if (data.onboardingOperationId) {
    const prior = await prisma.auditEvent.findFirst({
      where: {
        actor_user_id: session.userId,
        action: "onboarding.company",
        target_id: data.onboardingOperationId,
      },
    });
    if (prior?.metadata_json && typeof prior.metadata_json === "object") {
      const workspaceId = (prior.metadata_json as { workspaceId?: string }).workspaceId;
      if (workspaceId) {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
        const payload = await buildSessionPayloadFromUser(user, workspaceId);
        return jsonWithSessionCookie(request, { workspaceId, idempotent: true }, payload);
      }
    }
  }

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { user_id: session.userId, role: "OWNER" },
    include: { workspace: true },
    orderBy: { created_at: "asc" },
  });
  if (existingMembership?.workspace.company_setup_completed_at) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    const payload = await buildSessionPayloadFromUser(user);
    return jsonWithSessionCookie(
      request,
      { workspaceId: existingMembership.workspace_id, idempotent: true },
      payload,
    );
  }

  const slug = await pickUniqueSlug(data.companyName);
  const now = new Date();

  const workspaceId = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: data.companyName,
        slug,
        website,
        no_website: data.noWebsite,
        company_size: data.companySize ?? null,
        industry: data.industry?.trim() || null,
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        logo_asset_key: data.logoAssetKey ?? null,
        company_setup_completed_at: now,
        sample_mode_enabled: false,
        owner_user_id: session.userId,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspace_id: workspace.id,
        user_id: session.userId,
        role: "OWNER",
      },
    });

    await tx.user.update({
      where: { id: session.userId },
      data: { default_workspace_id: workspace.id },
    });

    await tx.userWorkspaceOnboarding.create({
      data: {
        user_id: session.userId,
        workspace_id: workspace.id,
      },
    });

    if (data.onboardingOperationId) {
      await tx.auditEvent.create({
        data: {
          workspace_id: workspace.id,
          actor_user_id: session.userId,
          action: "onboarding.company",
          target_type: "onboarding_operation",
          target_id: data.onboardingOperationId,
          metadata_json: { workspaceId: workspace.id },
        },
      });
    }

    return workspace.id;
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const payload = await buildSessionPayloadFromUser(user, workspaceId);
  return jsonWithSessionCookie(request, { workspaceId }, payload, { status: 201 });
}
