import { prisma } from "@repo/db";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "email and password are required",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse(request, {
        status: 401,
        code: "invalid_credentials",
        message: "Invalid credentials",
      });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return errorResponse(request, {
        status: 401,
        code: "invalid_credentials",
        message: "Invalid credentials",
      });
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: "asc" },
    });

    if (!member) {
      return errorResponse(request, {
        status: 403,
        code: "forbidden",
        message: "No workspace membership found",
      });
    }

    const payload: SessionPayload = {
      userId: user.id,
      workspaceId: user.default_workspace_id ?? member.workspace_id,
      role: member.role,
      email: user.email,
    };

    const token = await signSessionToken(payload);
    const response = jsonWithRequestId(request, { user: payload });
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
      code: "login_failed",
      message: "Unable to sign in. Verify Postgres is running and migrations are applied.",
    });
  }
}
