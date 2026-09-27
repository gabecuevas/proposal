import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { consumeAuthToken, findValidAuthToken } from "@/lib/auth/auth-tokens";
import { sendPasswordChangedNotice } from "@/lib/auth/verification-mail";

const bodySchema = z.object({ token: z.string().min(10) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Missing confirmation token.",
    });
  }

  const token = await findValidAuthToken({ rawToken: parsed.data.token, purpose: "PASSWORD_CHANGE" });
  const pendingHash = token?.pending_password_hash;
  if (!token || !pendingHash) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_token",
      message: "This confirmation link is invalid or expired. Request the change again from your profile.",
    });
  }

  const applied = await prisma.$transaction(async (tx) => {
    const ok = await consumeAuthToken({
      tokenId: token.id,
      userId: token.user_id,
      purpose: "PASSWORD_CHANGE",
      tx,
    });
    if (!ok) {
      return false;
    }
    await tx.user.update({
      where: { id: token.user_id },
      data: { password_hash: pendingHash },
    });
    await tx.authToken.updateMany({
      where: { id: token.id },
      data: { pending_password_hash: null },
    });
    await tx.authToken.updateMany({
      where: {
        user_id: token.user_id,
        purpose: "PASSWORD_RESET",
        consumed_at: null,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
    return true;
  });

  if (!applied) {
    return errorResponse(request, {
      status: 409,
      code: "token_consumed",
      message: "This confirmation link was already used.",
    });
  }

  // A notice failure must not undo or block a confirmed password change.
  try {
    await sendPasswordChangedNotice({
      userId: token.user_id,
      email: token.user.email,
      name: token.user.name,
      tokenId: token.id,
      request,
    });
  } catch (error) {
    console.error("[auth/password-change/confirm] notice email failed", error);
  }

  return jsonWithRequestId(request, { changed: true });
}
