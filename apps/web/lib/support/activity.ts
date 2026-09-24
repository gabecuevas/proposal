import { prisma } from "@repo/db";

const SESSION_GAP_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 60_000;

/** Record successful authentication as last_login (not token refresh). */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
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
  return prisma.activitySession.count({ where: { user_id: userId } });
}
