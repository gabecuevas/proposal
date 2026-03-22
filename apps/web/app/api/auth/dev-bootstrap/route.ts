import { prisma } from "@repo/db";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { createDocumentFromTemplate } from "@/lib/editor/document-store";
import { createTemplate, listTemplates } from "@/lib/editor/template-store";
import { hashPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

type DevBootstrapBody = {
  email?: string;
  password?: string;
  name?: string;
  workspaceName?: string;
};

const defaultBootstrap = {
  email: "demo@proposal.local",
  password: "demo12345",
  name: "Demo User",
  workspaceName: "Demo Workspace",
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as DevBootstrapBody;
    const email = body.email?.trim().toLowerCase() || defaultBootstrap.email;
    const password = body.password?.trim() || defaultBootstrap.password;
    const name = body.name?.trim() || defaultBootstrap.name;
    const workspaceName = body.workspaceName?.trim() || defaultBootstrap.workspaceName;

    if (password.length < 8) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "password must be at least 8 characters",
      });
    }

    const passwordHash = await hashPassword(password);

    const userAndWorkspace = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name,
            password_hash: passwordHash,
          },
        });
      }

      let membership = await tx.workspaceMember.findFirst({
        where: { user_id: user.id },
        orderBy: { created_at: "asc" },
      });

      if (!membership) {
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            owner_user_id: user.id,
          },
        });

        membership = await tx.workspaceMember.create({
          data: {
            workspace_id: workspace.id,
            user_id: user.id,
            role: "OWNER",
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { default_workspace_id: workspace.id },
        });
      } else if (!user.default_workspace_id) {
        await tx.user.update({
          where: { id: user.id },
          data: { default_workspace_id: membership.workspace_id },
        });
      }

      return { user, membership };
    });

    const workspaceId =
      userAndWorkspace.user.default_workspace_id ?? userAndWorkspace.membership.workspace_id;

    const existingTemplates = await listTemplates(workspaceId, { limit: 1 });
    const template =
      existingTemplates[0] ??
      (await createTemplate({
        name: "Starter Proposal Template",
        workspaceId,
        createdBy: userAndWorkspace.user.id,
      }));

    const document = await createDocumentFromTemplate(template.id, workspaceId);

    const payload: SessionPayload = {
      userId: userAndWorkspace.user.id,
      workspaceId,
      role: userAndWorkspace.membership.role,
      email: userAndWorkspace.user.email,
    };

    const token = await signSessionToken(payload);
    const response = jsonWithRequestId(
      request,
      {
        user: payload,
        bootstrapped: {
          templateId: template.id,
          documentId: document.id,
        },
      },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "dev_bootstrap_failed",
      message: "Unable to bootstrap demo account. Make sure Postgres is running and migrations are applied.",
    });
  }
}
