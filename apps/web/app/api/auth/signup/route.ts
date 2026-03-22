import { prisma } from "@repo/db";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

type SignupBody = {
  email?: string;
  password?: string;
  name?: string;
  workspaceName?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const name = body.name?.trim();
    const workspaceName = body.workspaceName?.trim() || `${name ?? "New"} Workspace`;

    if (!email || !password || !name) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "email, password, and name are required",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(request, {
        status: 409,
        code: "email_conflict",
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          password_hash: passwordHash,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          owner_user_id: user.id,
        },
      });

      await tx.workspaceMember.create({
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

      return {
        userId: user.id,
        email: user.email,
        workspaceId: workspace.id,
        role: "OWNER" as const,
      };
    });

    const payload: SessionPayload = {
      userId: result.userId,
      workspaceId: result.workspaceId,
      role: result.role,
      email: result.email,
    };
    const token = await signSessionToken(payload);
    const response = jsonWithRequestId(request, { user: payload }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "signup_failed",
      message: "Unable to create account. Verify Postgres is running and migrations are applied.",
    });
  }
}
