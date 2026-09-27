import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { passwordSchema } from "@/lib/auth/onboarding-schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isSudoSession, requireSessionFromRequest } from "@/lib/auth/session";
import { sendPasswordChangeConfirmation } from "@/lib/auth/verification-mail";
import { checkRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(128),
  newPassword: passwordSchema,
});

export async function POST(request: NextRequest) {
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }
  if (isSudoSession(session)) {
    return errorResponse(request, {
      status: 403,
      code: "sudo_active",
      message: "Passwords cannot be changed during a sudo session",
    });
  }

  const limit = checkRateLimit({
    key: `password-change:${session.userId}`,
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!limit.allowed) {
    return errorResponse(request, {
      status: 429,
      code: "rate_limited",
      message: "Too many password change attempts. Try again in a few minutes.",
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid password change request",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, password_hash: true, disabled_at: true },
  });
  if (!user || user.disabled_at) {
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }

  if (!(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_current_password",
      message: "Your current password is incorrect.",
    });
  }
  if (await verifyPassword(parsed.data.newPassword, user.password_hash)) {
    return errorResponse(request, {
      status: 400,
      code: "password_unchanged",
      message: "Choose a password different from your current one.",
    });
  }

  await sendPasswordChangeConfirmation({
    userId: user.id,
    email: user.email,
    name: user.name,
    pendingPasswordHash: await hashPassword(parsed.data.newPassword),
    request,
  });

  return jsonWithRequestId(request, { pending: true, email: user.email });
}
