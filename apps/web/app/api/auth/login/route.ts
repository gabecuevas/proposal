import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionPayloadFromUser, postAuthRedirectPath } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

type LoginBody = {
  email?: string;
  password?: string;
  next?: string;
};

export async function POST(request: NextRequest) {
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

    const payload = await buildSessionPayloadFromUser(user);
    const redirectHint = postAuthRedirectPath(payload, body.next ?? null);

    return jsonWithSessionCookie(request, { user: payload, redirectHint }, payload);
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "login_failed",
      message: "Unable to sign in. Verify Postgres is running and migrations are applied.",
    });
  }
}
