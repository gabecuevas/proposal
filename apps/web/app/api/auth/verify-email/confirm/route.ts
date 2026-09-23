import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { consumeAuthToken, findValidAuthToken, hashOpaqueToken } from "@/lib/auth/auth-tokens";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

type TokenStatus = {
  valid: boolean;
  expired: boolean;
  consumed: boolean;
  email?: string;
};

async function readTokenStatus(rawToken: string | null): Promise<TokenStatus> {
  if (!rawToken) {
    return { valid: false, expired: false, consumed: false };
  }
  const token = await findValidAuthToken({ rawToken, purpose: "EMAIL_VERIFY" });
  if (token) {
    return {
      valid: true,
      expired: false,
      consumed: false,
      email: token.pending_email ?? token.user.email,
    };
  }
  const tokenHash = hashOpaqueToken(rawToken);
  const row = await prisma.authToken.findUnique({ where: { token_hash: tokenHash } });
  if (!row || row.purpose !== "EMAIL_VERIFY") {
    return { valid: false, expired: false, consumed: false };
  }
  if (row.consumed_at) {
    return { valid: false, expired: false, consumed: true, email: row.pending_email ?? undefined };
  }
  if (row.expires_at.getTime() <= Date.now()) {
    return { valid: false, expired: true, consumed: false };
  }
  return { valid: false, expired: false, consumed: false };
}

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get("token");
  const status = await readTokenStatus(rawToken);
  return jsonWithRequestId(request, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const rawToken = body.token?.trim();
  if (!rawToken) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "token is required",
    });
  }

  const token = await findValidAuthToken({ rawToken, purpose: "EMAIL_VERIFY" });
  if (!token) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_token",
      message: "This verification link is invalid or expired.",
    });
  }

  const verifiedEmail = (token.pending_email ?? token.user.email).trim().toLowerCase();
  let consumed = false;
  try {
    consumed = await prisma.$transaction(async (tx) => {
      const ok = await consumeAuthToken({
        tokenId: token.id,
        userId: token.user_id,
        purpose: "EMAIL_VERIFY",
        generation: token.generation,
        tx,
      });
      if (!ok) {
        return false;
      }

      const emailConflict = await tx.user.findFirst({
        where: {
          email: verifiedEmail,
          NOT: { id: token.user_id },
        },
      });
      if (emailConflict) {
        throw new Error("email_conflict");
      }

      await tx.user.update({
        where: { id: token.user_id },
        data: {
          email: verifiedEmail,
          pending_email: null,
          email_verified_at: new Date(),
          verification_generation: { increment: 1 },
        },
      });
      return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "email_conflict") {
      return errorResponse(request, {
        status: 409,
        code: "email_conflict",
        message: "That email address is already in use.",
      });
    }
    throw error;
  }

  if (!consumed) {
    return errorResponse(request, {
      status: 409,
      code: "token_consumed",
      message: "This verification link was already used.",
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: token.user_id } });
  const payload = await buildSessionPayloadFromUser(user);

  return jsonWithSessionCookie(
    request,
    { verified: true, redirectHint: "/onboarding/company" },
    payload,
  );
}
