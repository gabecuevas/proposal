import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { normalizeIdentityEmail } from "@/lib/auth/onboarding-schemas";
import { verifyPassword } from "@/lib/auth/password";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";
import { sendEmailVerification } from "@/lib/auth/verification-mail";

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Enter a valid email and your password",
    });
  }

  const email = normalizeIdentityEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.email_verified_at) {
    return errorResponse(request, {
      status: 400,
      code: "not_eligible",
      message: "Email cannot be changed at this step.",
    });
  }

  const passwordOk = await verifyPassword(parsed.data.password, user.password_hash);
  if (!passwordOk) {
    return errorResponse(request, {
      status: 401,
      code: "invalid_credentials",
      message: "Password is incorrect",
    });
  }

  const conflict = await prisma.user.findFirst({
    where: { email, NOT: { id: user.id } },
  });
  if (conflict) {
    // Generic response — do not confirm another account exists via this path for unverified users
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Unable to use that email. Try a different address.",
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      pending_email: null,
      verification_generation: { increment: 1 },
    },
  });

  await sendEmailVerification({
    userId: updated.id,
    email: updated.email,
    name: updated.name,
    generation: updated.verification_generation,
    request,
  });

  const payload = await buildSessionPayloadFromUser(updated);
  return jsonWithSessionCookie(request, { pendingEmail: updated.email }, payload);
}
