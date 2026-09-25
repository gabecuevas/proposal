import { prisma } from "@repo/db";
import type { SessionPayload } from "./session";

export const ACCOUNT_DISABLED_MESSAGE =
  "This account has been disabled. Contact SendDox support for help.";

/**
 * Sessions are stateless JWTs, so disabling a user only takes effect where the
 * server checks the database. Returns false when the user no longer exists.
 */
export async function isSessionUserActive(session: SessionPayload): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { disabled_at: true },
  });
  return Boolean(user) && !user?.disabled_at;
}

/** Sudo sessions end when the target is disabled or the sudo record is closed/expired. */
export async function isSudoSessionLive(session: SessionPayload): Promise<boolean> {
  if (!session.impersonationId) {
    return true;
  }
  const record = await prisma.supportImpersonationSession.findUnique({
    where: { id: session.impersonationId },
    select: { ended_at: true, expires_at: true, target_user_id: true },
  });
  return Boolean(
    record &&
      !record.ended_at &&
      record.expires_at > new Date() &&
      record.target_user_id === session.userId,
  );
}

export async function recordSudoRequest(session: SessionPayload, request: Request): Promise<void> {
  if (!session.impersonationId) {
    return;
  }
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  try {
    const path = new URL(request.url).pathname;
    await prisma.$transaction([
      prisma.supportAuditEvent.create({
        data: {
          actor_user_id: session.impersonatorUserId ?? null,
          action: "sudo.request",
          target_type: "User",
          target_id: session.userId,
          metadata_json: {
            impersonationId: session.impersonationId,
            method,
            path,
          },
        },
      }),
      prisma.supportImpersonationSession.update({
        where: { id: session.impersonationId },
        data: { request_count: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    console.error("[sudo] failed to record request", error);
  }
}
