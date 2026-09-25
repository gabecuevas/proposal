import { prisma } from "@repo/db";

/**
 * Subscription billing must skip charges, renewals, and dunning for frozen
 * workspaces. Admins toggle this from Admin → Contacts → Actions → Freeze billing.
 */
export async function isWorkspaceBillingFrozen(workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billing_frozen_at: true },
  });
  return Boolean(workspace?.billing_frozen_at);
}
