import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonWithRequestId } from "@/lib/api/response";
import { normalizeIdentityEmail } from "@/lib/auth/onboarding-schemas";
import { sendPasswordReset } from "@/lib/auth/verification-mail";

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
});

const GENERIC = {
  message: "If an account exists for that email, password reset instructions have been sent.",
};

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonWithRequestId(request, GENERIC);
  }

  const email = normalizeIdentityEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.email_verified_at) {
    await sendPasswordReset({
      userId: user.id,
      email: user.email,
      name: user.name,
      request,
    });
  }

  return jsonWithRequestId(request, GENERIC);
}
