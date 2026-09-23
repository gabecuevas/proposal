import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { sendEmailVerification } from "@/lib/auth/verification-mail";

const GENERIC = { message: "If your account is eligible, a verification email has been sent." };

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.email_verified_at) {
    return jsonWithRequestId(request, GENERIC);
  }

  const targetEmail = user.pending_email ?? user.email;
  await sendEmailVerification({
    userId: user.id,
    email: targetEmail,
    name: user.name,
    generation: user.verification_generation,
    request,
  });

  return jsonWithRequestId(request, GENERIC);
}
