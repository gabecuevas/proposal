import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { consumeAuthToken, findValidAuthToken } from "@/lib/auth/auth-tokens";
import { passwordSchema } from "@/lib/auth/onboarding-schemas";
import { hashPassword } from "@/lib/auth/password";

const bodySchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid reset payload",
    });
  }

  const token = await findValidAuthToken({
    rawToken: parsed.data.token,
    purpose: "PASSWORD_RESET",
  });
  if (!token) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_token",
      message: "This reset link is invalid or expired.",
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const consumed = await prisma.$transaction(async (tx) => {
    const ok = await consumeAuthToken({
      tokenId: token.id,
      userId: token.user_id,
      purpose: "PASSWORD_RESET",
      tx,
    });
    if (!ok) {
      return false;
    }
    await tx.user.update({
      where: { id: token.user_id },
      data: { password_hash: passwordHash },
    });
    return true;
  });

  if (!consumed) {
    return errorResponse(request, {
      status: 409,
      code: "token_consumed",
      message: "This reset link was already used.",
    });
  }

  return jsonWithRequestId(request, { reset: true, redirectHint: "/login" });
}
