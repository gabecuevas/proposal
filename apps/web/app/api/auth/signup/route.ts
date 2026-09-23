import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import {
  normalizeIdentityEmail,
  PRIVACY_VERSION,
  signupSchema,
  TERMS_VERSION,
} from "@/lib/auth/onboarding-schemas";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";
import { sendEmailVerification } from "@/lib/auth/verification-mail";

const SIGNUP_SUCCESS = {
  message: "Check your email to verify your account and continue setup.",
};

export async function POST(request: NextRequest) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid signup payload",
      });
    }

    const email = normalizeIdentityEmail(parsed.data.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonWithRequestId(request, SIGNUP_SUCCESS);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.fullName,
        password_hash: passwordHash,
        provisional_company_name: parsed.data.companyName,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    });

    await sendEmailVerification({
      userId: user.id,
      email: user.email,
      name: user.name,
      generation: user.verification_generation,
      request,
    });

    const payload = await buildSessionPayloadFromUser(user);
    return jsonWithSessionCookie(request, SIGNUP_SUCCESS, payload, { status: 201 });
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "signup_failed",
      message: "Unable to create account. Verify Postgres is running and migrations are applied.",
    });
  }
}
