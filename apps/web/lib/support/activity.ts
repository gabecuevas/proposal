import { Prisma, prisma } from "@repo/db";
import { ipLocationUserData, type IpLocation } from "./geo";

const SESSION_GAP_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 60_000;
/** Record successful authentication as last_login (not token refresh). */
export async function recordSuccessfulLogin(
  userId: string,
  location?: IpLocation | null,
): Promise<void> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tracked_since: true },
  });
  if (!user) {
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      last_login_at: now,
      last_active_at: now,
      ...(user.tracked_since ? {} : { tracked_since: now }),
      ...ipLocationUserData(location),
    },
  });
}

/**
 * Bounded activity heartbeat for authenticated foreground navigation/interaction.
 * Creates a new ActivitySession after 30 minutes of inactivity.
 */
export async function recordMeaningfulActivity(input: {
  userId: string;
  workspaceId?: string | null;
  location?: IpLocation | null;
}): Promise<void> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { last_active_at: true, tracked_since: true },
  });
  if (!user) {
    return;
  }

  if (user.last_active_at && now.getTime() - user.last_active_at.getTime() < ACTIVITY_THROTTLE_MS) {
    return;
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      last_active_at: now,
      ...(user.tracked_since ? {} : { tracked_since: now }),
      ...ipLocationUserData(input.location),
    },
  });

  const open = await prisma.activitySession.findFirst({
    where: {
      user_id: input.userId,
      ended_at: null,
    },
    orderBy: { last_seen_at: "desc" },
  });

  if (open && now.getTime() - open.last_seen_at.getTime() < SESSION_GAP_MS) {
    await prisma.activitySession.update({
      where: { id: open.id },
      data: {
        last_seen_at: now,
        ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
      },
    });
    return;
  }

  if (open) {
    await prisma.activitySession.update({
      where: { id: open.id },
      data: { ended_at: open.last_seen_at },
    });
  }

  await prisma.activitySession.create({
    data: {
      user_id: input.userId,
      workspace_id: input.workspaceId ?? null,
      started_at: now,
      last_seen_at: now,
    },
  });
}

export async function countTrackedSessions(userId: string): Promise<number> {
  const counts = await countQualifiedSessions([userId]);
  return counts.get(userId) ?? 0;
}

/** Sessions lasting at least five minutes, keyed by user id. */
export async function countQualifiedSessions(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.$queryRaw<Array<{ user_id: string; count: bigint }>>`
    SELECT "user_id", COUNT(*)::bigint AS "count"
    FROM "ActivitySession"
    WHERE "user_id" IN (${Prisma.join(userIds)})
      AND "last_seen_at" - "started_at" >= interval '5 minutes'
    GROUP BY "user_id"
  `;
  return new Map(rows.map((row) => [row.user_id, Number(row.count)]));
}
