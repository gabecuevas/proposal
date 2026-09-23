import { prisma } from "@repo/db";
import { hashPassword } from "./password";
import { buildSessionPayloadFromUser } from "./session-builder";
import type { SessionPayload } from "./session";

export type OAuthResolveInput = {
  email: string;
  name: string;
  googleSub: string;
};

export type OAuthResolveResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; code: "google_account_exists" };

export async function resolveOAuthSession(input: OAuthResolveInput): Promise<OAuthResolveResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim() || "Google User";

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    if (existingUser.google_sub && existingUser.google_sub !== input.googleSub) {
      return { ok: false, code: "google_account_exists" };
    }
    if (!existingUser.google_sub) {
      return { ok: false, code: "google_account_exists" };
    }

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email_verified_at: existingUser.email_verified_at ?? new Date(),
      },
    });
    return { ok: true, payload: await buildSessionPayloadFromUser(user) };
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: normalizedName,
      password_hash: passwordHash,
      google_sub: input.googleSub,
      email_verified_at: new Date(),
      provisional_company_name: `${normalizedName.split(" ")[0] ?? normalizedName}'s Company`,
    },
  });

  return { ok: true, payload: await buildSessionPayloadFromUser(user) };
}
