import { prisma } from "@repo/db";
import { planDisplayName } from "./plans";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export type WorkspaceBillingState = {
  plan: string | null;
  planName: string;
  billingInterval: string | null;
  subscriptionStatus: string | null;
  hasActiveSubscription: boolean;
  hasBillingAccount: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  seatLimit: number | null;
  seatsUsed: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export async function countUsedSeats(workspaceId: string): Promise<number> {
  const [members, pendingInvites] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspace_id: workspaceId } }),
    prisma.workspaceInvite.count({
      where: {
        workspace_id: workspaceId,
        revoked_at: null,
        accepted_at: null,
        expires_at: { gt: new Date() },
      },
    }),
  ]);
  return members + pendingInvites;
}

export async function getWorkspaceBillingState(workspaceId: string): Promise<WorkspaceBillingState | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      billing_interval: true,
      subscription_status: true,
      stripe_customer_id: true,
      trial_ends_at: true,
      seat_limit: true,
      subscription_current_period_end: true,
      subscription_cancel_at_period_end: true,
    },
  });
  if (!workspace) {
    return null;
  }
  const hasActiveSubscription = Boolean(
    workspace.subscription_status && ACTIVE_SUBSCRIPTION_STATUSES.has(workspace.subscription_status),
  );
  const onTrial = workspace.plan === "trial" && !hasActiveSubscription;
  const now = Date.now();
  const trialEndsAtMs = workspace.trial_ends_at?.getTime() ?? null;
  const trialExpired = onTrial && trialEndsAtMs !== null && trialEndsAtMs <= now;
  const trialDaysLeft =
    onTrial && trialEndsAtMs !== null
      ? Math.max(0, Math.ceil((trialEndsAtMs - now) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    plan: workspace.plan,
    planName: planDisplayName(workspace.plan),
    billingInterval: workspace.billing_interval,
    subscriptionStatus: workspace.subscription_status,
    hasActiveSubscription,
    hasBillingAccount: Boolean(workspace.stripe_customer_id),
    trialEndsAt: workspace.trial_ends_at?.toISOString() ?? null,
    trialDaysLeft,
    trialExpired,
    seatLimit: workspace.seat_limit,
    seatsUsed: await countUsedSeats(workspaceId),
    currentPeriodEnd: workspace.subscription_current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: workspace.subscription_cancel_at_period_end,
  };
}

/**
 * Returns an error message when inviting `emails` would exceed the workspace
 * seat limit, or null when the invites fit (or the plan is unlimited). Emails
 * that already hold a seat (member or pending invite) are not counted again.
 */
export async function seatLimitError(workspaceId: string, emails: string[]): Promise<string | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { seat_limit: true, plan: true },
  });
  if (!workspace || workspace.seat_limit === null || emails.length === 0) {
    return null;
  }
  const unique = [...new Set(emails)];
  const [members, pending] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId, user: { email: { in: unique } } },
      select: { user: { select: { email: true } } },
    }),
    prisma.workspaceInvite.findMany({
      where: {
        workspace_id: workspaceId,
        email: { in: unique },
        revoked_at: null,
        accepted_at: null,
        expires_at: { gt: new Date() },
      },
      select: { email: true },
    }),
  ]);
  const seated = new Set([...members.map((row) => row.user.email), ...pending.map((row) => row.email)]);
  const additional = unique.filter((email) => !seated.has(email)).length;
  if (additional === 0) {
    return null;
  }
  const used = await countUsedSeats(workspaceId);
  if (used + additional <= workspace.seat_limit) {
    return null;
  }
  const remaining = Math.max(0, workspace.seat_limit - used);
  const planName = planDisplayName(workspace.plan);
  if (remaining === 0) {
    return `Your ${planName} plan has no open seats. Upgrade or add seats in Settings → Billing.`;
  }
  return `Your ${planName} plan has ${remaining} open seat${remaining === 1 ? "" : "s"}. Upgrade or add seats in Settings → Billing.`;
}
